import { PropertyPreviewProps } from "firecms";

export function PriceTextPreview({
                                     value,
                                     property,
                                     size,
                                     customProps,
                                 }: PropertyPreviewProps<number>) {

    return (
        <div className={`${value ? "" : "text-sm text-zinc-500"}`}>
            {value ?? "Not available"}
        </div>
    );

};
