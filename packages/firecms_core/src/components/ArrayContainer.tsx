import React, { useCallback, useEffect, useRef, useState } from "react";

import { DragDropContext, Draggable, DraggableProvided, Droppable } from "@hello-pangea/dnd";

import { getHashValue } from "../util";
import useMeasure from "react-use-measure";
import {
    AddIcon,
    Button,
    ContentCopyIcon,
    fieldBackgroundHoverMixin,
    IconButton,
    Menu,
    MenuItem,
    MoreVertIcon,
    RemoveIcon,
    Tooltip
} from "@firecms/ui";

interface ArrayContainerProps<T> {
    droppableId: string;
    value: T[];
    addLabel: string;
    buildEntry: (index: number, internalId: number) => React.ReactNode;
    disabled?: boolean;
    size?: "small" | "medium";
    onInternalIdAdded?: (id: number) => void;
    includeAddButton?: boolean;
    newDefaultEntry: T;
    onValueChange: (value: T[]) => void
}

const buildIdsMap = (value: any[]) =>
    value && Array.isArray(value) && value.length > 0
        ? value.map((v, index) => {
            if (!v) return {};
            return ({
                [getHashValue(v) + index]: getRandomId()
            });
        }).reduce((a, b) => ({ ...a, ...b }), {})
        : {}

/**
 * @group Form custom fields
 */
export function ArrayContainer<T>({
                                      droppableId,
                                      addLabel,
                                      value,
                                      disabled = false,
                                      buildEntry,
                                      size,
                                      onInternalIdAdded,
                                      includeAddButton,
                                      newDefaultEntry,
                                      onValueChange
                                  }: ArrayContainerProps<T>) {

    const hasValue = value && Array.isArray(value) && value.length > 0;

    // Used to track the ids that have displayed the initial show animation
    const internalIdsRef = useRef<Record<string, number>>(buildIdsMap(value));

    const [internalIds, setInternalIds] = useState<number[]>(
        hasValue
            ? Object.values(internalIdsRef.current)
            : []);

    useEffect(() => {
        if (hasValue && value && value.length !== internalIds.length) {
            const newInternalIds = value.map((v, index) => {
                const hashValue = getHashValue(v) + index;
                if (hashValue in internalIdsRef.current) {
                    return internalIdsRef.current[hashValue];
                } else {
                    const newInternalId = getRandomId();
                    internalIdsRef.current[hashValue] = newInternalId;
                    return newInternalId;
                }
            });
            setInternalIds(newInternalIds);
        }
    }, [hasValue, internalIds.length, value]);

    const insertInEnd = (e: React.SyntheticEvent) => {
        e.preventDefault();
        if (disabled) return;
        const id = getRandomId();
        const newIds: number[] = [...internalIds, id];
        if (onInternalIdAdded)
            onInternalIdAdded(id);
        setInternalIds(newIds);
        onValueChange([...(value ?? []), newDefaultEntry]);
    };

    const remove = (index: number) => {
        const newIds = [...internalIds];
        newIds.splice(index, 1);
        setInternalIds(newIds);
        onValueChange(value.filter((_, i) => i !== index));
    };

    const copy = (index: number) => {
        const id = getRandomId();
        const copyingItem = value[index];
        const newIds: number[] = [
            ...internalIds.splice(0, index + 1),
            id,
            ...internalIds.splice(index + 1, internalIds.length - index - 1)];
        if (onInternalIdAdded)
            onInternalIdAdded(id);
        setInternalIds(newIds);
        // insert value in index + 1
        onValueChange([...value.slice(0, index + 1), copyingItem, ...value.slice(index + 1)]);
    };

    const onDragEnd = (result: any) => {
        // dropped outside the list
        if (!result.destination) {
            return;
        }
        const sourceIndex = result.source.index;
        const destinationIndex = result.destination.index;

        const newIds = [...internalIds];
        const temp = newIds[sourceIndex];
        newIds[sourceIndex] = newIds[destinationIndex];
        newIds[destinationIndex] = temp;
        setInternalIds(newIds);

        onValueChange(arrayMove(value, sourceIndex, destinationIndex));
    };

    return (
        <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId={droppableId}
                       renderClone={(provided, snapshot, rubric) => {
                           const index = rubric.source.index;
                           const internalId = internalIds[index];
                           return (
                               <ArrayContainerItem
                                   provided={provided}
                                   internalId={internalId}
                                   index={index}
                                   size={size}
                                   disabled={disabled}
                                   buildEntry={buildEntry}
                                   remove={remove}
                                   copy={copy}
                                   isDragging={snapshot.isDragging}
                               />
                           );
                       }}
            >
                {(droppableProvided, droppableSnapshot) => (
                    <div
                        {...droppableProvided.droppableProps}
                        ref={droppableProvided.innerRef}>
                        {hasValue && internalIds.map((internalId: number, index: number) => {
                            return (
                                <Draggable
                                    key={`array_field_${internalId}`}
                                    draggableId={`array_field_${internalId}`}
                                    isDragDisabled={disabled}
                                    index={index}>
                                    {(provided, snapshot) => (
                                        <ArrayContainerItem
                                            provided={provided}
                                            internalId={internalId}
                                            index={index}
                                            size={size}
                                            disabled={disabled}
                                            buildEntry={buildEntry}
                                            remove={remove}
                                            copy={copy}
                                            isDragging={snapshot.isDragging}
                                        />
                                    )}
                                </Draggable>
                            );
                        })}

                        {droppableProvided.placeholder}

                        {includeAddButton && <div className="py-4 justify-center text-left">
                            <Button
                                variant={"text"}
                                size={size === "small" ? "small" : "medium"}
                                color="primary"
                                disabled={disabled}
                                startIcon={<AddIcon/>}
                                onClick={insertInEnd}>
                                {addLabel ?? "Add"}
                            </Button>
                        </div>}
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
}

type ArrayContainerItemProps = {
    provided: DraggableProvided,
    index: number,
    internalId: number,
    size?: "small" | "medium",
    disabled: boolean,
    buildEntry: (index: number, internalId: number) => React.ReactNode,
    remove: (index: number) => void,
    copy: (index: number) => void,
    isDragging: boolean,
};

export function ArrayContainerItem({
                                       provided,
                                       index,
                                       internalId,
                                       size,
                                       disabled,
                                       buildEntry,
                                       remove,
                                       copy,
                                       isDragging
                                   }: ArrayContainerItemProps) {

    const [measureRef, bounds] = useMeasure();

    const measuring = size !== "small" && bounds.height === 0;
    const menuOverflow = size !== "small" && bounds.height < 100;

    const [onHover, setOnHover] = React.useState(false);
    const setOnHoverTrue = useCallback(() => setOnHover(true), []);
    const setOnHoverFalse = useCallback(() => setOnHover(false), []);

    return <div
        onMouseEnter={setOnHoverTrue}
        onMouseMove={setOnHoverTrue}
        onMouseLeave={setOnHoverFalse}
        ref={provided.innerRef}
        {...provided.draggableProps}
        style={provided.draggableProps.style}
        className={`${
            (isDragging || onHover) ? fieldBackgroundHoverMixin : ""
        } mb-1 rounded-md opacity-100`}
    >
        <div
            className="flex items-start">
            <div ref={measureRef}
                 className="flex-grow w-[calc(100%-48px)] text-text-primary dark:text-text-primary-dark"
            >
                {buildEntry(index, internalId)}
            </div>
            <ArrayItemOptions direction={size === "small" ? "row" : "column"}
                              disabled={disabled}
                              remove={remove}
                              index={index}
                              provided={provided}
                              measuring={measuring}
                              contentOverflow={menuOverflow}
                              copy={copy}/>
        </div>
    </div>;
}

export function ArrayItemOptions({
                                     direction,
                                     disabled,
                                     remove,
                                     index,
                                     provided,
                                     copy,
                                     contentOverflow,
                                     measuring
                                 }: {
    direction?: "row" | "column",
    contentOverflow: boolean,
    measuring: boolean,
    disabled: boolean,
    remove: (index: number) => void,
    index: number,
    provided: any,
    copy: (index: number) => void
}) {

    return <div className={`p-1 flex ${direction === "row" ? "flex-row-reverse" : "flex-col"} items-center`}
                {...provided.dragHandleProps}
    >
        <Tooltip
            side={direction === "column" ? "left" : undefined}
            title="Move">
            <IconButton
                size="small"
                disabled={disabled}
                className={`cursor-${disabled ? "inherit" : "grab"}`}>
                {/* TODO: for some reason, the icon as a span does not work with Drag and Drop
                */}
                <svg focusable="false"
                     fill={"currentColor"}
                     aria-hidden="true" viewBox="0 0 24 24">
                    <path d="M20 9H4v2h16V9zM4 15h16v-2H4v2z"></path>
                </svg>
                {/*<DragHandleIcon*/}
                {/*    size={"small"}*/}
                {/*    color={disabled ? "disabled" : "inherit"}/>*/}
            </IconButton>
        </Tooltip>

        {!measuring && !contentOverflow && <>
            <Tooltip
                title="Remove"
                side={direction === "column" ? "left" : undefined}>
                <IconButton
                    size="small"
                    aria-label="remove"
                    disabled={disabled}
                    onClick={() => remove(index)}>
                    <RemoveIcon
                        size={"small"}/>
                </IconButton>
            </Tooltip>

            <Tooltip
                side={direction === "column" ? "left" : undefined}
                title="Copy in this position">
                <IconButton
                    size="small"
                    aria-label="copy"
                    disabled={disabled}
                    onClick={() => copy(index)}>
                    <ContentCopyIcon
                        size={"small"}/>
                </IconButton>
            </Tooltip>
        </>}

        {!measuring && contentOverflow && <>

            <Menu
                trigger={<IconButton size={"small"}>
                    <MoreVertIcon
                        size={"small"}/>
                </IconButton>}
            >

                <MenuItem dense onClick={() => remove(index)}>
                    <RemoveIcon size={"small"}/>
                    Remove
                </MenuItem>
                <MenuItem dense onClick={() => copy(index)}>
                    <ContentCopyIcon size={"small"}/>
                    Copy
                </MenuItem>

            </Menu>
        </>}
    </div>;
}

function arrayMove(value: any[], sourceIndex: number, destinationIndex: number) {
    const result = Array.from(value);
    const [removed] = result.splice(sourceIndex, 1);
    result.splice(destinationIndex, 0, removed);
    return result;
}

export function getRandomId() {
    return Math.floor(Math.random() * Math.floor(Number.MAX_SAFE_INTEGER));
}
