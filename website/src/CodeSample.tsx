import React from "react";
import { cn, Paper } from "@firecms/ui";

export type CodeSampleProps = {
    children: React.ReactNode;
    className?: string;
}

export default function CodeSample({
                                       children,
                                       className
                                   }: CodeSampleProps) {
    return (
        <Paper className={cn("p-8 bg-gray-50",
            "flex flex-row gap-4 items-center justify-center",
            className)}>
            {children}
        </Paper>
    );
}
