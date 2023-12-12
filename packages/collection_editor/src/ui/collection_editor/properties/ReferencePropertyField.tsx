import React from "react";
import { Field, getIn, useFormikContext } from "formik";
import {
    CircularProgress,
    EntityCollection,
    getIconForView,
    NumberProperty,
    Select,
    SelectGroup,
    SelectItem,
    StringProperty,
    Typography,
    useNavigationContext
} from "@firecms/core";
import { FieldHelperView } from "./FieldHelperView";

export function ReferencePropertyField({
                                           existing,
                                           multiple,
                                           disabled,
                                           showErrors
                                       }: { existing: boolean, multiple: boolean, disabled: boolean, showErrors: boolean }) {

    const {
        values,
        handleChange,
        errors,
        touched,
        setFieldError,
        setFieldValue
    } = useFormikContext<StringProperty | NumberProperty>();

    const navigation = useNavigationContext();

    if (!navigation)
        return <div className={"col-span-12"}>
            <CircularProgress/>
        </div>;

    const pathPath = multiple ? "of.path" : "path";
    const pathValue: string | undefined = getIn(values, pathPath);
    const pathError: string | undefined = showErrors && getIn(errors, pathPath);

    console.log("pathError", errors, pathError)

    return (
        <>
            <div className={"col-span-12"}>
                <Field required
                       name={pathPath}
                       pathPath={pathPath}
                       type="select"
                       validate={validatePath}
                       disabled={existing || disabled}
                       value={pathValue}
                       error={pathError}
                       handleChange={handleChange}
                       component={CollectionsSelect}/>

            </div>

        </>
    );
}

function validatePath(value?: string) {
    let error;
    if (!value) {
        error = "You must specify a target collection for the field";
    }
    return error;
}

export function CollectionsSelect({
                                      disabled,
                                      pathPath,
                                      value,
                                      handleChange,
                                      error,
                                      ...props
                                  }: {
    disabled: boolean,
    pathPath: string,
    value?: string,
    handleChange: (event: any) => void,
    error?: string
}) {

    console.log("error", error)

    const navigation = useNavigationContext();

    if (!navigation)
        return <div className={"col-span-12"}>
            <CircularProgress/>
        </div>;

    const collections = navigation?.collections ?? [];

    const groups: string[] = Array.from(new Set(
        Object.values(collections).map(e => e.group).filter(Boolean) as string[]
    ).values());

    const ungroupedCollections = collections.filter((col) => !col.group);

    return (
        <>
            <Select
                error={Boolean(error)}
                disabled={disabled}
                value={value ?? ""}
                position={"item-aligned"}
                name={pathPath}
                onChange={handleChange}
                label={"Target collection"}
                renderValue={(selected) => {
                    const selectedCollection = collections.find(collection => collection.alias === selected || collection.path === selected);
                    if (!selectedCollection) return null;
                    const collectionIcon = getIconForView(selectedCollection);
                    return (
                        <div className="flex flex-row">
                            {collectionIcon}
                            <Typography
                                variant={"subtitle2"}
                                className="font-medium ml-4">
                                {selectedCollection?.name.toUpperCase()}
                            </Typography>
                        </div>)
                }}
                {...props}>

                {groups.flatMap((group) => (
                    <SelectGroup label={group || "Views"}
                                 key={`group_${group}`}>
                        {
                            collections.filter(collection => collection.group === group)
                                .map((collection) => {
                                    const collectionIcon = getIconForView(collection);
                                    return <SelectItem
                                        key={`${collection.alias ?? collection.path}-${group}`}
                                        value={collection.alias ?? collection.path}>
                                        <div className="flex flex-row">
                                            {collectionIcon}
                                            <Typography
                                                variant={"subtitle2"}
                                                className="font-medium ml-4">
                                                {collection?.name.toUpperCase()}
                                            </Typography>
                                        </div>
                                    </SelectItem>;
                                })

                        }
                    </SelectGroup>
                ))}

                {ungroupedCollections && <SelectGroup label={"Views"}>
                    {ungroupedCollections
                        .map((collection) => {
                            const collectionIcon = getIconForView(collection);
                            return <SelectItem key={collection.alias ?? collection.path}
                                               value={collection.alias ?? collection.path}>
                                <div className="flex flex-row">
                                    {collectionIcon}
                                    <Typography
                                        variant={"subtitle2"}
                                        className="font-medium ml-4">
                                        {collection?.name.toUpperCase()}
                                    </Typography>
                                </div>
                            </SelectItem>;
                        })

                    }
                </SelectGroup>}

            </Select>

            <FieldHelperView>
                You can only edit the reference collection upon field
                creation.
            </FieldHelperView>
        </>
    );
}