import { useState } from "react";

import { format } from "date-fns";
import * as locales from "date-fns/locale";

import {
    defaultDateFormat,
    DeleteConfirmationDialog,
    FireCMSContext,
    useFireCMSContext,
    useSnackbarController
} from "@firecms/core";
import {
    Chip,
    DeleteIcon,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHeader,
    TableRow,
    Tooltip,
} from "@firecms/ui";
import { FireCMSUserProject } from "../../types/firecms_user";
import { getUserRoles } from "../../utils/permissions";
import { useUserManagement } from "../../hooks/useUserManagement";

export function UsersTable({ onUserClicked }: {
    onUserClicked: (user: FireCMSUserProject) => void;
}) {

    const {
        users,
        roles,
        deleteUser
    } = useUserManagement();

    const snackbarController = useSnackbarController();

    const appConfig: FireCMSContext<any> | undefined = useFireCMSContext();
    const dateUtilsLocale = appConfig?.locale ? locales[appConfig?.locale as keyof typeof locales] : undefined;
    const dateFormat: string = appConfig?.dateTimeFormat ?? defaultDateFormat;

    const [userToBeDeleted, setUserToBeDeleted] = useState<FireCMSUserProject | undefined>(undefined);
    const [deleteInProgress, setDeleteInProgress] = useState<boolean>(false);

    return (
        <div className="overflow-auto">

            <Table >

                <TableHeader>
                    <TableCell className="truncate w-16"></TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Roles</TableCell>
                    <TableCell>Created on</TableCell>
                </TableHeader>
                <TableBody>
                    {users && users.map((user) => {

                        const userRoleIds: string[] | undefined = user.roles;
                        if (!userRoleIds) return null;
                        const userRoles = getUserRoles(roles, user);

                        const formattedDate = user.created_on ? format(user.created_on, dateFormat, { locale: dateUtilsLocale }) : "";

                        return (
                            <TableRow
                                key={"row_" + user.uid}
                                onClick={() => {
                                    onUserClicked(user);
                                }}
                            >
                                <TableCell className={"w-10"}>
                                    <Tooltip title={"Delete this user"}>
                                        <IconButton
                                            size={"small"}
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                return setUserToBeDeleted(user);
                                            }}>
                                            <DeleteIcon/>
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                                <TableCell>{user.uid}</TableCell>
                                <TableCell>{user.email}</TableCell>
                                <TableCell className={"font-medium align-left"}>{user.displayName}</TableCell>
                                <TableCell className="align-left">
                                    {userRoles
                                        ? <div className="flex flex-wrap gap-2">
                                            {userRoles.map(userRole =>
                                                <Chip
                                                    colorScheme={"cyanLight"}
                                                    key={userRole.id}>
                                                    {userRole.name}
                                                </Chip>)}
                                        </div>
                                        : null}
                                </TableCell>
                                <TableCell>{formattedDate}</TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>

            <DeleteConfirmationDialog
                open={Boolean(userToBeDeleted)}
                loading={deleteInProgress}
                onAccept={() => {
                    if (userToBeDeleted) {
                        setDeleteInProgress(true);
                        deleteUser(userToBeDeleted)
                            .then(() => {
                                setUserToBeDeleted(undefined);
                            })
                            .catch((error) => {
                                snackbarController.open({
                                    type: "error",
                                    message: "Error deleting user: " + error.message,
                                })
                            })
                            .finally(() => {
                                setDeleteInProgress(false);
                            })
                    }
                }}
                onCancel={() => {
                    setUserToBeDeleted(undefined);
                }}
                title={<>Delete?</>}
                body={<>Are you sure you want to delete this user?</>}/>
        </div>);
}
