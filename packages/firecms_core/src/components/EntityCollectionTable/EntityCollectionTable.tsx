import React, { useCallback, useContext, useEffect, useMemo } from "react";
import equal from "react-fast-compare";
import {
    AdditionalFieldDelegate,
    CollectionSize,
    Entity,
    FilterValues,
    FireCMSContext,
    ResolvedProperty,
    SelectedCellProps,
    User
} from "../../types";
import { PropertyTableCell } from "./internal/PropertyTableCell";
import { ErrorBoundary } from "../ErrorBoundary";
import { useFireCMSContext, useLargeLayout } from "../../hooks";
import { CellRendererParams, VirtualTable, VirtualTableColumn } from "../VirtualTable";
import { enumToObjectEntries, getValueInPath } from "../../util";
import { getRowHeight } from "../VirtualTable/common";
import { EntityCollectionRowActions } from "./internal/EntityCollectionRowActions";
import { EntityCollectionTableController } from "./types";
import { CollectionTableToolbar } from "./internal/CollectionTableToolbar";
import { EntityCollectionTableProps } from "./EntityCollectionTableProps";
import { EntityTableCell } from "./internal/EntityTableCell";
import { FilterFormFieldProps } from "../VirtualTable/VirtualTableHeader";
import { ReferenceFilterField } from "./filters/ReferenceFilterField";
import { StringNumberFilterField } from "./filters/StringNumberFilterField";
import { BooleanFilterField } from "./filters/BooleanFilterField";
import { DateTimeFilterField } from "./filters/DateTimeFilterField";
import { CustomFieldValidator } from "../../form/validation";
import { renderSkeletonText } from "../../preview";
import { propertiesToColumns } from "./column_utils";

const DEFAULT_STATE = {} as any;

export const EntityCollectionTableContext = React.createContext<EntityCollectionTableController<any>>(DEFAULT_STATE);

export const useEntityCollectionTableController = () => useContext<EntityCollectionTableController<any>>(EntityCollectionTableContext);

/**
 * This component is in charge of rendering a collection table with a high
 * degree of customization.
 *
 * This component is used internally by {@link EntityCollectionView} and
 * {@link useReferenceDialog}
 *
 * Please note that you only need to use this component if you are building
 * a custom view. If you just need to create a default view you can do it
 * exclusively with config options.
 *
 * If you want to bind a {@link EntityCollection} to a table with the default
 * options you see in collections in the top level navigation, you can
 * check {@link EntityCollectionView}.
 *
 * The data displayed in the table is managed by a {@link EntityTableController}.
 * You can build the default, bound to a path in the datasource, by using the hook
 * {@link useDataSourceEntityCollectionTableController}
 *
 * @see EntityCollectionTableProps
 * @see EntityCollectionView
 * @see VirtualTable
 * @group Components
 */
export const EntityCollectionTable = React.memo<EntityCollectionTableProps<any>>(
    function EntityCollectionTable<M extends Record<string, any>, UserType extends User>
    ({
         forceFilter,
         actionsStart,
         actions,
         title,
         tableRowActionsBuilder,
         uniqueFieldValidator,
         getPropertyFor,
         onValueChange,
         selectionController,
         highlightedEntities,
         onEntityClick,
         onColumnResize,
         onSizeChanged,
         textSearchEnabled = false,
         hoverRow = true,
         inlineEditing = false,
         additionalFields,
         displayedColumnIds,
         defaultSize,
         properties,
         tableController:
             {
                 data,
                 dataLoading,
                 noMoreToLoad,
                 dataLoadingError,
                 filterValues,
                 setFilterValues,
                 sortBy,
                 setSortBy,
                 setSearchString,
                 clearFilter,
                 itemCount,
                 setItemCount,
                 pageSize = 50,
                 paginationEnabled,
                 checkFilterCombination,
                 setPopupCell
             },
         filterable = true,
         sortable = true,
         endAdornment,
         AddColumnComponent,
         AdditionalHeaderWidget,
         additionalIDHeaderWidget,
         emptyComponent,
         getIdColumnWidth,
         onTextSearchClick,
         textSearchLoading
     }: EntityCollectionTableProps<M>) {

        const largeLayout = useLargeLayout();
        const disabledFilterChange = Boolean(forceFilter);
        const selectedEntities = selectionController?.selectedEntities?.length > 0 ? selectionController?.selectedEntities : highlightedEntities;

        const context: FireCMSContext<UserType> = useFireCMSContext();

        const [size, setSize] = React.useState<CollectionSize>(defaultSize ?? "m");

        const [selectedCell, setSelectedCell] = React.useState<SelectedCellProps<M> | undefined>(undefined);

        const selectedEntityIds = selectedEntities?.map(e => e.id);

        const filterIsSet = !!filterValues && Object.keys(filterValues).length > 0;

        const loadNextPage = () => {
            if (!paginationEnabled || dataLoading || noMoreToLoad)
                return;
            if (itemCount !== undefined)
                setItemCount?.(itemCount + pageSize);
        };

        const resetPagination = useCallback(() => {
            setItemCount?.(pageSize);
        }, [pageSize]);

        const onRowClick = useCallback(({ rowData }: {
            rowData: Entity<M>
        }) => {
            console.debug("EntityCollectionTable click");
            if (inlineEditing)
                return;
            return onEntityClick && onEntityClick(rowData);
        }, [onEntityClick, inlineEditing]);

        const updateSize = useCallback((size: CollectionSize) => {
            if (onSizeChanged)
                onSizeChanged(size);
            setSize(size);
        }, []);

        const onTextSearch = useCallback((newSearchString?: string) => setSearchString?.(newSearchString), []);

        const additionalFieldsMap: Record<string, AdditionalFieldDelegate<M, UserType>> = useMemo(() => {
            return (additionalFields
                ? additionalFields
                    .map((aC) => ({ [aC.key]: aC as AdditionalFieldDelegate<M, any> }))
                    .reduce((a, b) => ({ ...a, ...b }), {})
                : {}) as Record<string, AdditionalFieldDelegate<M, UserType>>;
        }, [additionalFields]);

        // on ESC key press
        useEffect(() => {
            const escFunction = (event: any) => {
                if (event.keyCode === 27) {
                    unselect();
                }
            };
            document.addEventListener("keydown", escFunction, false);
            return () => {
                document.removeEventListener("keydown", escFunction, false);
            };
        });

        const select = useCallback((cell?: SelectedCellProps<M>) => {
            setSelectedCell(cell);
        }, []);

        const unselect = useCallback(() => {
            setSelectedCell(undefined);
        }, []);

        const customFieldValidator: CustomFieldValidator | undefined = uniqueFieldValidator;

        const propertyCellRenderer = useCallback(({
                                                      column,
                                                      columnIndex,
                                                      rowData,
                                                      rowIndex
                                                  }: CellRendererParams<any>) => {

            const entity: Entity<M> = rowData;

            const propertyKey = column.key;

            let disabled = column.custom?.disabled;
            const propertyValue = entity.values ? getValueInPath(entity.values, propertyKey) : undefined;
            const property = getPropertyFor?.({
                propertyKey,
                propertyValue,
                entity
            }) ?? column.custom.resolvedProperty;
            if (!property?.disabled) {
                disabled = false;
            }

            if (!property) {
                return null;
            }

            return (
                <ErrorBoundary>
                    {entity
                        ? <PropertyTableCell
                            key={`property_table_cell_${entity.id}_${propertyKey}`}
                            readonly={!inlineEditing}
                            align={column.align ?? "left"}
                            propertyKey={propertyKey as string}
                            property={property}
                            value={entity?.values ? getValueInPath(entity.values, propertyKey) : undefined}
                            customFieldValidator={customFieldValidator}
                            columnIndex={columnIndex}
                            width={column.width}
                            height={getRowHeight(size)}
                            entity={entity}
                            disabled={disabled}
                            path={entity.path}/>
                        : renderSkeletonText()
                    }
                </ErrorBoundary>);

        }, [customFieldValidator, inlineEditing, size, selectedEntityIds]);

        const additionalCellRenderer = useCallback(({
                                                        column,
                                                        rowData,
                                                        width
                                                    }: CellRendererParams<any>) => {

            const entity: Entity<M> = rowData;

            const additionalField = additionalFieldsMap[column.key as string];
            const value = additionalField.dependencies
                ? Object.entries(entity.values)
                    .filter(([key, value]) => additionalField.dependencies!.includes(key as Extract<keyof M, string>))
                    .reduce((a, b) => ({ ...a, ...b }), {})
                : entity;

            const Builder = additionalField.Builder;
            if (!Builder && !additionalField.value) {
                throw new Error("When using additional fields you need to provide a Builder or a value");
            }

            const child = Builder
                ? <Builder entity={entity} context={context}/>
                : <>{additionalField.value?.({ entity, context })}</>;

            return (
                <EntityTableCell
                    key={`additional_table_cell_${entity.id}_${column.key}`}
                    width={width}
                    size={size}
                    value={value}
                    selected={false}
                    disabled={true}
                    align={"left"}
                    allowScroll={false}
                    showExpandIcon={false}
                    disabledTooltip={"This column can't be edited directly"}
                >
                    <ErrorBoundary>
                        {child}
                    </ErrorBoundary>
                </EntityTableCell>
            );

        }, [additionalFieldsMap, size, selectedEntityIds]);

        const collectionColumns: VirtualTableColumn[] = useMemo(() => {
                const columnsResult: VirtualTableColumn[] = propertiesToColumns({
                    properties,
                    sortable,
                    forceFilter,
                    disabledFilter: disabledFilterChange,
                    AdditionalHeaderWidget
                });

                const additionalTableColumns: VirtualTableColumn[] = additionalFields
                    ? additionalFields.map((additionalField) =>
                        ({
                            key: additionalField.key,
                            align: "left",
                            sortable: false,
                            title: additionalField.name,
                            width: additionalField.width ?? 200
                        }))
                    : [];
                return [...columnsResult, ...additionalTableColumns];
            },
            [additionalFields, disabledFilterChange, forceFilter, properties, sortable]);

        const idColumn: VirtualTableColumn = useMemo(() => ({
            key: "id_ewcfedcswdf3",
            width: getIdColumnWidth?.() ?? (largeLayout ? 160 : 130),
            title: "ID",
            resizable: false,
            frozen: largeLayout,
            headerAlign: "center",
            align: "center",
            AdditionalHeaderWidget: () => additionalIDHeaderWidget
        }), [getIdColumnWidth, largeLayout])

        const columns: VirtualTableColumn[] = useMemo(() => [
            idColumn,
            ...displayedColumnIds
                .map((p) => {
                    return collectionColumns.find(c => c.key === p.key);
                }).filter(Boolean) as VirtualTableColumn[]
        ], [collectionColumns, displayedColumnIds, idColumn]);

        const cellRenderer = useCallback((props: CellRendererParams<any>) => {
            const column = props.column;
            const columns = props.columns;
            const columnKey = column.key;
            if (props.columnIndex === 0) {
                if (tableRowActionsBuilder)
                    return tableRowActionsBuilder({
                        entity: props.rowData,
                        size,
                        width: column.width,
                        frozen: column.frozen
                    });
                else
                    return <EntityCollectionRowActions entity={props.rowData}
                                                       width={column.width}
                                                       frozen={column.frozen}
                                                       isSelected={false}
                                                       size={size}/>;
            } else if (additionalFieldsMap[columnKey]) {
                return additionalCellRenderer(props);
            } else if (props.columnIndex < columns.length + 1) {
                return propertyCellRenderer(props);
            } else {
                throw Error("Internal: columns not mapped properly");
            }
        }, [additionalFieldsMap, tableRowActionsBuilder, size, additionalCellRenderer, propertyCellRenderer])

        const onFilterUpdate = useCallback((updatedFilterValues?: FilterValues<any>) => {
            setFilterValues?.({ ...updatedFilterValues, ...forceFilter } as FilterValues<any>);
        }, [forceFilter]);

        return (

            <EntityCollectionTableContext.Provider
                value={{
                    setPopupCell: setPopupCell as ((cell?: SelectedCellProps<M>) => void),
                    select,
                    onValueChange,
                    size,
                    selectedCell
                }}
            >

                <div className="h-full w-full flex flex-col bg-white dark:bg-gray-950">

                    <CollectionTableToolbar
                        forceFilter={disabledFilterChange}
                        filterIsSet={filterIsSet}
                        onTextSearch={textSearchEnabled ? onTextSearch : undefined}
                        textSearchLoading={textSearchLoading}
                        onTextSearchClick={textSearchEnabled ? onTextSearchClick : undefined}
                        clearFilter={clearFilter}
                        size={size}
                        onSizeChanged={updateSize}
                        title={title}
                        actionsStart={actionsStart}
                        actions={actions}
                        loading={dataLoading}/>

                    <VirtualTable
                        data={data}
                        columns={columns}
                        cellRenderer={cellRenderer}
                        onRowClick={inlineEditing ? undefined : (onEntityClick ? onRowClick : undefined)}
                        onEndReached={loadNextPage}
                        onResetPagination={resetPagination}
                        error={dataLoadingError}
                        paginationEnabled={paginationEnabled}
                        onColumnResize={onColumnResize}
                        size={size}
                        loading={dataLoading}
                        filter={filterValues}
                        onFilterUpdate={setFilterValues ? onFilterUpdate : undefined}
                        sortBy={sortBy}
                        onSortByUpdate={setSortBy as ((sortBy?: [string, "asc" | "desc"]) => void)}
                        hoverRow={hoverRow}
                        emptyComponent={emptyComponent}
                        checkFilterCombination={checkFilterCombination}
                        createFilterField={filterable ? createFilterField : undefined}
                        rowClassName={useCallback((entity: Entity<M>) => {
                            return selectedEntityIds?.includes(entity.id) ? "bg-gray-100 bg-opacity-75 dark:bg-gray-800 dark:bg-opacity-75" : "";
                        }, [selectedEntityIds])}
                        className="flex-grow"
                        endAdornment={endAdornment}
                        AddColumnComponent={AddColumnComponent}
                    />

                </div>
            </EntityCollectionTableContext.Provider>
        );

    },
    equal
);

function createFilterField({
                               id,
                               filterValue,
                               setFilterValue,
                               column,
                               hidden,
                               setHidden
                           }: FilterFormFieldProps<{
    resolvedProperty: ResolvedProperty,
    disabled: boolean,
}>): React.ReactNode {

    if (!column.custom) {
        return null;
    }

    const { resolvedProperty } = column.custom;

    const isArray = resolvedProperty?.dataType === "array";
    const baseProperty: ResolvedProperty = isArray ? resolvedProperty.of : resolvedProperty;
    if (!baseProperty) {
        return null;
    }
    if (baseProperty.dataType === "reference") {
        return <ReferenceFilterField value={filterValue}
                                     setValue={setFilterValue}
                                     name={id as string}
                                     isArray={isArray}
                                     path={baseProperty.path}
                                     title={resolvedProperty?.name}
                                     previewProperties={baseProperty?.previewProperties}
                                     hidden={hidden}
                                     setHidden={setHidden}/>;
    } else if (baseProperty.dataType === "number" || baseProperty.dataType === "string") {
        const name = baseProperty.name;
        const enumValues = baseProperty.enumValues ? enumToObjectEntries(baseProperty.enumValues) : undefined;
        return <StringNumberFilterField value={filterValue}
                                        setValue={setFilterValue}
                                        name={id as string}
                                        dataType={baseProperty.dataType}
                                        isArray={isArray}
                                        enumValues={enumValues}
                                        title={name}/>;
    } else if (baseProperty.dataType === "boolean") {
        const name = baseProperty.name;
        return <BooleanFilterField value={filterValue}
                                   setValue={setFilterValue}
                                   name={id as string}
                                   title={name}/>;

    } else if (baseProperty.dataType === "date") {
        const title = baseProperty.name;
        return <DateTimeFilterField value={filterValue}
                                    setValue={setFilterValue}
                                    name={id as string}
                                    mode={baseProperty.mode}
                                    isArray={isArray}
                                    title={title}/>;
    }

    return (
        <div>{`Currently the filter field ${resolvedProperty.dataType} is not supported`}</div>
    );
}
