import { useCallback, useState } from "react";
import { DataType, Entity, getPropertyInPath, Properties, Property } from "@firecms/core";
import { DataTypeMapping, ImportConfig } from "../types";

export const useImportConfig = (): ImportConfig => {

    const [inUse, setInUse] = useState<boolean>(false);
    const [idColumn, setIdColumn] = useState<string | undefined>();
    const [importData, setImportData] = useState<object[]>([]);
    const [entities, setEntities] = useState<Entity<any>[]>([]);
    const [headersMapping, setHeadersMapping] = useState<Record<string, string | null>>({});
    const [originProperties, setOriginProperties] = useState<Record<string, Property>>({});

    return {
        inUse,
        setInUse,
        idColumn,
        setIdColumn,
        entities,
        setEntities,
        importData,
        setImportData,
        headersMapping,
        setHeadersMapping,
        originProperties,
        setOriginProperties,
    };
};
