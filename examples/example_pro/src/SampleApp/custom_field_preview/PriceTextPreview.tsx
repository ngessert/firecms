import React from "react";
import { PropertyPreviewProps } from "@firecms/firebase_pro";

export default function PriceTextPreview({
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
