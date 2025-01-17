import React from "react";
import { Button, CollectionActionsProps, useSnackbarController } from "@firecms/firebase_pro";

export function SampleCollectionActions({ selectionController }: CollectionActionsProps) {

    const snackbarController = useSnackbarController();

    const onClick = (event: React.MouseEvent) => {
        const selectedEntities = selectionController?.selectedEntities;
        const count = selectedEntities ? selectedEntities.length : 0;
        snackbarController.open({
            type: "success",
            message: `User defined code here! ${count} products selected`
        });
    };

    return (
        <Button onClick={onClick}
                color="primary"
                variant={"text"}>
            Extra action
        </Button>
    );

}
