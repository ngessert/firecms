import React from "react";

import { FieldProps } from "../../types";

import { FieldHelperText, LabelWithIcon } from "../components";
import { useClearRestoreValue } from "../../hooks";
import { getIconForProperty } from "../../util";
import { DateTimeField } from "../../ui";

type DateTimeFieldProps = FieldProps<Date>;

/**
 * Field that allows selecting a date
 *
 * This is one of the internal components that get mapped natively inside forms
 * and tables to the specified properties.
 * @group Form fields
 */
export function DateTimeFieldBinding({
                                         propertyKey,
                                         value,
                                         setValue,
                                         autoFocus,
                                         error,
                                         showError,
                                         disabled,
                                         touched,
                                         property,
                                         includeDescription
                                     }: DateTimeFieldProps) {

    const internalValue = value || null;

    useClearRestoreValue({
        property,
        value,
        setValue
    });

    return (
        <>
            <DateTimeField
                value={internalValue}
                onChange={(dateValue) => setValue(dateValue)}
                size={"medium"}
                mode={property.mode}
                clearable={property.clearable}
                label={<LabelWithIcon
                    icon={getIconForProperty(property, "small")}
                    required={property.validation?.required}
                    className={"text-text-secondary dark:text-text-secondary-dark"}
                    title={property.name}/>}
            />

            <FieldHelperText includeDescription={includeDescription}
                             showError={showError}
                             error={error}
                             disabled={disabled}
                             property={property}/>

        </>
    );
}