import React, { MouseEventHandler, useCallback, useEffect, useMemo, useState } from "react";
import { CollectionSize, Entity, EntityCollection, FilterValues } from "../types";

import { EntityCollectionTable } from "./EntityCollectionTable";
import { EntityCollectionRowActions } from "./EntityCollectionTable/internal/EntityCollectionRowActions";
import {
    useAuthController,
    useDataSource,
    useFireCMSContext,
    useLargeLayout,
    useNavigationController,
    useSideEntityController
} from "../hooks";
import { ErrorView } from "./ErrorView";
import { AddIcon, Button, DialogActions, Typography } from "@firecms/ui";
import { canCreateEntity, fullPathToCollectionSegments, resolveCollection } from "../util";
import { useSelectionController } from "./EntityCollectionView/EntityCollectionView";
import { useDataSourceEntityCollectionTableController } from "./EntityCollectionTable/useDataSourceEntityCollectionTableController";
import { useColumnIds } from "./EntityCollectionView/useColumnsIds";
import { useSideDialogContext } from "../core";

/**
 * @group Components
 */
export interface ReferenceSelectionInnerProps<M extends Record<string, any>> {

    /**
     * Allow multiple selection of values
     */
    multiselect?: boolean;

    /**
     * Entity collection config
     */
    collection?: EntityCollection<M>;

    /**
     * Absolute path of the collection.
     * May be not set if this hook is being used in a component and the path is
     * dynamic. If not set, the dialog won't open.
     */
    path: string;

    /**
     * If you are opening the dialog for the first time, you can select some
     * entity ids to be displayed first.
     */
    selectedEntityIds?: string[];

    /**
     * If `multiselect` is set to `false`, you will get the selected entity
     * in this callback.
     * @param entity
     * @callback
     */
    onSingleEntitySelected?(entity: Entity<any> | null): void;

    /**
     * If `multiselect` is set to `true`, you will get the selected entities
     * in this callback.
     * @param entities
     * @callback
     */
    onMultipleEntitiesSelected?(entities: Entity<any>[]): void;

    /**
     * Allow selection of entities that pass the given filter only.
     */
    forceFilter?: FilterValues<string>;

    /**
     * Use this description to indicate the user what to do in this dialog.
     */
    description?: React.ReactNode;

    /**
     * Maximum number of entities that can be selected.
     */
    maxSelection?: number;

}

/**
 * This component allows to select entities from a given collection.
 * You probably want to open this dialog as a side view using {@link useReferenceDialog}
 * @group Components
 */
export function ReferenceSelectionInner<M extends Record<string, any>>(
    {
        onSingleEntitySelected,
        onMultipleEntitiesSelected,
        multiselect,
        collection,
        path: pathInput,
        selectedEntityIds: selectedEntityIdsProp,
        description,
        forceFilter,
        maxSelection
    }: ReferenceSelectionInnerProps<M>) {

    const sideDialogContext = useSideDialogContext();
    const sideEntityController = useSideEntityController();
    const navigation = useNavigationController();
    const context = useFireCMSContext();

    const fullPath = navigation.resolveAliasesFrom(pathInput);

    const dataSource = useDataSource();

    const [entitiesDisplayedFirst, setEntitiesDisplayedFirst] = useState<Entity<any>[]>([]);

    const selectionController = useSelectionController();

    /**
     * Fetch initially selected ids
     */
    useEffect(() => {
        let unmounted = false;
        const selectedEntityIds = selectedEntityIdsProp?.map(id => id?.toString()).filter(Boolean);
        if (selectedEntityIds && collection) {
            Promise.all(
                selectedEntityIds.map((entityId) =>
                    dataSource.fetchEntity({
                        path: fullPath,
                        entityId,
                        collection
                    })))
                .then((entities) => {
                    if (!unmounted) {
                        const result = entities.filter(e => e !== undefined) as Entity<any>[];
                        selectionController.setSelectedEntities(result);
                        setEntitiesDisplayedFirst(result);
                    }
                });
        } else {
            selectionController.setSelectedEntities([]);
            setEntitiesDisplayedFirst([]);
        }
        return () => {
            unmounted = true;
        };
    }, [dataSource, fullPath, selectedEntityIdsProp, collection, selectionController.setSelectedEntities]);

    const onClear = () => {
        context.onAnalyticsEvent?.("reference_selection_clear", {
            path: fullPath
        });
        selectionController.setSelectedEntities([]);
        if (!multiselect && onSingleEntitySelected) {
            onSingleEntitySelected(null);
        } else if (onMultipleEntitiesSelected) {
            onMultipleEntitiesSelected([]);
        }
    };

    const toggleEntitySelection = (entity: Entity<any>) => {
        console.debug("ReferenceSelectionInner toggleEntitySelection", entity);
        let newValue;
        const selectedEntities = selectionController.selectedEntities;

        context.onAnalyticsEvent?.("reference_selection_toggle", {
            path: fullPath,
            entityId: entity.id
        });
        if (selectedEntities) {

            if (selectedEntities.map((e) => e.id).indexOf(entity.id) > -1) {
                newValue = selectedEntities.filter((item: Entity<any>) => item.id !== entity.id);
            } else {
                if (maxSelection && selectedEntities.length >= maxSelection)
                    return;
                newValue = [...selectedEntities, entity];
            }
            selectionController.setSelectedEntities(newValue);

            if (onMultipleEntitiesSelected)
                onMultipleEntitiesSelected(newValue);
        }
    };

    const onEntityClick = (entity: Entity<any>) => {
        console.debug("ReferenceSelectionInner onEntityClick", entity);

        if (!multiselect && onSingleEntitySelected) {
            context.onAnalyticsEvent?.("reference_selected_single", {
                path: fullPath,
                entityId: entity.id
            });
            onSingleEntitySelected(entity);
            sideDialogContext.close(false);
        } else {
            toggleEntitySelection(entity);
        }
    };

    // create a new entity from within the reference dialog
    const onNewClick = () => {
        context.onAnalyticsEvent?.("reference_selection_new_entity", {
            path: fullPath
        });
        sideEntityController.open({
            path: fullPath,
            collection,
            updateUrl: true,
            onUpdate: ({ entity }) => {
                setEntitiesDisplayedFirst([entity, ...entitiesDisplayedFirst]);
                onEntityClick(entity);
            },
            closeOnSave: true
        });
    };

    const tableRowActionsBuilder = ({
                                        entity,
                                        size,
                                        width,
                                        frozen
                                    }: {
        entity: Entity<any>,
        size: CollectionSize,
        width: number,
        frozen?: boolean
    }) => {
        const selectedEntities = selectionController.selectedEntities;
        const isSelected = selectedEntities && selectedEntities.map(e => e.id).indexOf(entity.id) > -1;
        return <EntityCollectionRowActions
            width={width}
            frozen={frozen}
            entity={entity}
            size={size}
            isSelected={isSelected}
            selectionEnabled={multiselect}
            hideId={collection?.hideIdFromCollection}
            fullPath={fullPath}
            selectionController={selectionController}/>;

    };

    const onDone = useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation();
        sideDialogContext.close(false);
    }, [sideDialogContext]);

    if (!collection) {
        return <ErrorView
            error={"Could not find collection with id " + collection}/>
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const resolvedCollection = useMemo(() => resolveCollection({
        collection: collection,
        path: fullPath,
        values: {},
        fields: context.propertyConfigs
    }), [collection, context.propertyConfigs, fullPath]);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const displayedColumnIds = useColumnIds(resolvedCollection, false);

    // eslint-disable-next-line react-hooks/rules-of-hooks
    const tableController = useDataSourceEntityCollectionTableController<M>({
        fullPath,
        collection,
        entitiesDisplayedFirst,
        forceFilter
    });

    return (

        <div className="flex flex-col h-full">

            <div className="flex-grow">
                {entitiesDisplayedFirst &&
                    <EntityCollectionTable
                        displayedColumnIds={displayedColumnIds}
                        onEntityClick={onEntityClick}
                        tableController={tableController}
                        tableRowActionsBuilder={tableRowActionsBuilder}
                        title={<Typography variant={"subtitle2"}>
                            {collection.singularName ? `Select ${collection.singularName}` : `Select from ${collection.name}`}
                        </Typography>}
                        defaultSize={collection.defaultSize}
                        properties={resolvedCollection.properties}
                        forceFilter={forceFilter}
                        inlineEditing={false}
                        selectionController={selectionController}
                        actions={<ReferenceDialogActions
                            collection={collection}
                            path={fullPath}
                            onNewClick={onNewClick}
                            onClear={onClear}/>
                        }
                    />}
            </div>
            <DialogActions translucent={false}>
                {description &&
                    <Typography variant={"body2"}
                                className="flex-grow text-left">
                        {description}
                    </Typography>}
                <Button
                    onClick={onDone}
                    color="primary"
                    variant="filled">
                    Done
                </Button>
            </DialogActions>
        </div>

    );

}

function ReferenceDialogActions({
                                    collection,
                                    path,
                                    onClear,
                                    onNewClick
                                }: {
    collection: EntityCollection<any>,
    path: string,
    onClear: () => void,
    onNewClick: () => void
}) {

    const authController = useAuthController();

    const largeLayout = useLargeLayout();

    const onClick: MouseEventHandler<HTMLButtonElement> | undefined = onNewClick
        ? (e) => {
            e.preventDefault();
            onNewClick();
        }
        : undefined;
    const addButton = canCreateEntity(collection, authController, fullPathToCollectionSegments(path), null) &&
        onClick && (largeLayout
            ? <Button
                onClick={onClick}
                startIcon={<AddIcon/>}
                variant="outlined"
                color="primary">
                Add {collection.singularName ?? collection.name}
            </Button>
            : <Button
                onClick={onClick}
                size="medium"
                variant="outlined"
                color="primary"
            >
                <AddIcon/>
            </Button>);

    return (
        <>
            <Button onClick={onClear}
                    variant={"text"}
                    color="primary">
                Clear
            </Button>
            {addButton}
        </>
    );
}
