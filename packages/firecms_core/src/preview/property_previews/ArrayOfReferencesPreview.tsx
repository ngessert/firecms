import { ResolvedReferenceProperty } from "../../types";
import { resolveArrayProperty } from "../../util";
import { useFireCMSContext } from "../../hooks";
import { PreviewSize, PropertyPreviewProps } from "../PropertyPreviewProps";
import { ReferencePreview } from "../components/ReferencePreview";

/**
 * @group Preview components
 */
export function ArrayOfReferencesPreview({
                                             propertyKey,
                                             value,
                                             property: inputProperty,
                                             size
                                         }: PropertyPreviewProps<any[]>) {

    const fireCMSContext = useFireCMSContext();
    const property = resolveArrayProperty({
        propertyKey,
        property: inputProperty,
        propertyValue: value,
        fields: fireCMSContext.propertyConfigs
    });

    if (Array.isArray(property?.of)) {
        throw Error("Using array properties instead of single one in `of` in ArrayProperty");
    }

    if (property?.dataType !== "array" || !property.of || property.of.dataType !== "reference")
        throw Error("Picked wrong preview component ArrayOfReferencesPreview");

    const childSize: PreviewSize = size === "medium" ? "small" : "tiny";

    return (
        <div className="flex flex-col w-full">
            {value &&
                value.map((reference, index) => {
                        const ofProperty = property.of as ResolvedReferenceProperty;
                        return <div className="mt-1 mb-1 w-full"
                                    key={`preview_array_ref_${propertyKey}_${index}`}>
                            <ReferencePreview
                                disabled={!ofProperty.path}
                                previewProperties={ofProperty.previewProperties}
                                size={childSize}
                                reference={reference}
                            />
                        </div>;
                    }
                )}
        </div>
    );
}
