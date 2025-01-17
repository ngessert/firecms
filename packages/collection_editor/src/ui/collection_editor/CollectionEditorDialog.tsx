import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    CircularProgressCenter,
    CMSType,
    EntityCollection,
    ErrorView,
    isPropertyBuilder,
    MapProperty,
    mergeDeep,
    Properties,
    PropertiesOrBuilders,
    Property,
    PropertyConfig,
    PropertyOrBuilder,
    randomString,
    removeInitialAndTrailingSlashes,
    removeUndefined,
    TopNavigationResult,
    useAuthController,
    useFireCMSContext,
    useNavigationController,
    User,
    useSnackbarController
} from "@firecms/core";
import {
    ArrowBackIcon,
    Button,
    cn,
    coolIconKeys,
    defaultBorderMixin,
    Dialog,
    DialogActions,
    DialogContent,
    DoneIcon,
    IconButton,
    LoadingButton,
    Tab,
    Tabs,
} from "@firecms/ui";
import { Form, Formik, FormikHelpers } from "formik";
import { YupSchema } from "./CollectionYupValidation";
import { CollectionDetailsForm } from "./CollectionDetailsForm";
import { CollectionPropertiesEditorForm } from "./CollectionPropertiesEditorForm";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import { SubcollectionsEditTab } from "./SubcollectionsEditTab";
import { CollectionsConfigController } from "../../types/config_controller";
import { CollectionEditorWelcomeView } from "./CollectionEditorWelcomeView";
import { CollectionInference } from "../../types/collection_inference";
import { getInferenceType, ImportSaveInProgress, useImportConfig } from "@firecms/data_import_export";
import { buildEntityPropertiesFromData } from "@firecms/schema_inference";
import { CollectionEditorImportMapping } from "./import/CollectionEditorImportMapping";
import { CollectionEditorImportDataPreview } from "./import/CollectionEditorImportDataPreview";
import { cleanPropertiesFromImport } from "./import/clean_import_data";
import { PersistedCollection } from "../../types/persisted_collection";

export interface CollectionEditorDialogProps {
    open: boolean;
    isNewCollection: boolean;
    initialValues?: {
        group?: string,
        path?: string,
        name?: string,
    }
    editedCollectionPath?: string; // last segment of the path, like `locales`
    fullPath?: string; // full path of this particular collection, like `products/123/locales`
    parentCollectionIds?: string[]; // path ids of the parent collection, like [`products`]
    handleClose: (collection?: EntityCollection) => void;
    configController: CollectionsConfigController;
    reservedGroups?: string[];
    collectionInference?: CollectionInference;
    extraView?: {
        View: React.ComponentType<{
            path: string
        }>,
        icon: React.ReactNode
    };
    pathSuggestions?: (path?: string) => Promise<string[]>;
    getUser: (uid: string) => User | null;
    getData?: (path: string, parentPaths: string[]) => Promise<object[]>;
    parentCollection?: PersistedCollection;
}

export function CollectionEditorDialog(props: CollectionEditorDialogProps) {

    const open = props.open;

    const [formDirty, setFormDirty] = React.useState<boolean>(false);
    const [unsavedChangesDialogOpen, setUnsavedChangesDialogOpen] = React.useState<boolean>(false);

    const handleCancel = useCallback(() => {
        if (!formDirty) {
            props.handleClose(undefined);
        } else {
            setUnsavedChangesDialogOpen(true);
        }
    }, [formDirty, props.handleClose]);

    useEffect(() => {
        if (!open) {
            setFormDirty(false);
            setUnsavedChangesDialogOpen(false);
        }
    }, [open]);

    return (
        <Dialog
            open={open}
            fullWidth={true}
            fullHeight={true}
            scrollable={false}
            maxWidth={"7xl"}
            onOpenChange={(open) => !open ? handleCancel() : undefined}
        >
            {open && <CollectionEditorDialogInternal {...props}
                                                     handleCancel={handleCancel}
                                                     setFormDirty={setFormDirty}/>}

            <UnsavedChangesDialog
                open={unsavedChangesDialogOpen}
                handleOk={() => props.handleClose(undefined)}
                handleCancel={() => setUnsavedChangesDialogOpen(false)}
                body={"There are unsaved changes in this collection"}/>

        </Dialog>
    );
}

type EditorView = "welcome"
    | "details"
    | "import_data_mapping"
    | "import_data_preview"
    | "import_data_saving"
    | "properties"
    | "loading"
    | "extra_view"
    | "subcollections";

export function CollectionEditorDialogInternal<M extends {
    [Key: string]: CMSType
}>({
       isNewCollection,
       initialValues: initialValuesProp,
       configController,
       editedCollectionPath,
       parentCollectionIds,
       fullPath,
       collectionInference,
       handleClose,
       reservedGroups,
       extraView,
       handleCancel,
       setFormDirty,
       pathSuggestions,
       getUser,
       parentCollection,
       getData
   }: CollectionEditorDialogProps & {
       handleCancel: () => void,
       setFormDirty: (dirty: boolean) => void
   }
) {

    const { propertyConfigs } = useFireCMSContext();
    const navigation = useNavigationController();
    const {
        topLevelNavigation,
        collections
    } = navigation;

    const includeTemplates = !initialValuesProp?.path && (parentCollectionIds ?? []).length === 0;
    const collectionsInThisLevel = (parentCollection ? parentCollection.subcollections : collections) ?? [];
    const existingPaths = collectionsInThisLevel.map(col => col.path.trim().toLowerCase());
    const existingIds = collectionsInThisLevel.map(col => col.id?.trim().toLowerCase()).filter(Boolean) as string[];

    const importConfig = useImportConfig();

    if (!topLevelNavigation) {
        throw Error("Internal: Navigation not ready in collection editor");
    }

    const {
        groups
    }: TopNavigationResult = topLevelNavigation;

    const snackbarController = useSnackbarController();
    const authController = useAuthController();

    // Use this ref to store which properties have errors
    const propertyErrorsRef = useRef({});

    const initialView = isNewCollection ? (includeTemplates ? "welcome" : "details") : "properties";
    const [currentView, setCurrentView] = useState<EditorView>(initialView); // this view can edit either the details view or the properties one

    const [error, setError] = React.useState<Error | undefined>();

    const [collection, setCollection] = React.useState<PersistedCollection<M> | undefined>();
    const [initialLoadingCompleted, setInitialLoadingCompleted] = React.useState(false);
    const [initialError, setInitialError] = React.useState<Error | undefined>();

    useEffect(() => {
        try {
            if (navigation.initialised) {
                if (editedCollectionPath) {
                    setCollection(navigation.getCollectionFromPaths<PersistedCollection<M>>([...(parentCollectionIds ?? []), editedCollectionPath]));
                } else {
                    setCollection(undefined);
                }
                setInitialLoadingCompleted(true);
            }
        } catch (e) {
            console.error(e);
            setInitialError(initialError);
        }
    }, [navigation.getCollectionFromPaths, editedCollectionPath, initialError, navigation.initialised]);

    const saveCollection = (updatedCollection: PersistedCollection<M>): Promise<boolean> => {
        const fullPath = updatedCollection.id || updatedCollection.path;
        return configController.saveCollection({
            id: fullPath,
            collectionData: updatedCollection,
            previousPath: editedCollectionPath,
            parentCollectionIds
        })
            .then(() => {
                setError(undefined);
                return true;
            })
            .catch((e) => {
                setError(e);
                console.error(e);
                snackbarController.open({
                    type: "error",
                    message: "Error persisting collection: " + (e.message ?? "Details in the console")
                });
                return false;
            });
    };

    const initialCollection = collection
        ? {
            ...collection,
            id: collection.id ?? collection.path ?? randomString(16)
        }
        : undefined;

    const initialValues: PersistedCollection<M> = initialCollection
        ? applyPropertyConfigs(initialCollection, propertyConfigs)
        : {
            id: initialValuesProp?.path ?? randomString(16),
            path: initialValuesProp?.path ?? "",
            name: initialValuesProp?.name ?? "",
            group: initialValuesProp?.group ?? "",
            properties: {} as PropertiesOrBuilders<M>,
            propertiesOrder: [],
            icon: coolIconKeys[Math.floor(Math.random() * coolIconKeys.length)],
            ownerId: authController.user?.uid ?? ""
        };

    const setNextMode = useCallback(() => {
        if (currentView === "details") {
            if (importConfig.inUse) {
                setCurrentView("import_data_saving");
            } else if (extraView) {
                setCurrentView("extra_view");
            } else {
                setCurrentView("properties");
            }
        } else if (currentView === "welcome") {
            setCurrentView("details");
        } else if (currentView === "import_data_mapping") {
            setCurrentView("import_data_preview");
        } else if (currentView === "import_data_preview") {
            setCurrentView("details");
        } else if (currentView === "extra_view") {
            setCurrentView("properties");
        } else {
            setCurrentView("details");
        }

    }, [currentView, importConfig.inUse, extraView]);

    const doCollectionInference = useCallback((collection: PersistedCollection<any>) => {
        if (!collectionInference) return undefined;
        return collectionInference?.(collection.path, collection.collectionGroup ?? false, parentCollectionIds ?? []);
    }, [collectionInference, parentCollectionIds]);

    const inferCollectionFromData = useCallback(async (newCollection: PersistedCollection<M>) => {

        try {
            if (!doCollectionInference) {
                setCollection(newCollection);
                return Promise.resolve(newCollection);
            }

            setCurrentView("loading");

            const inferredCollection = await doCollectionInference?.(newCollection);

            if (!inferredCollection) {
                setCollection(newCollection);
                return Promise.resolve(newCollection);
            }
            const values = {
                ...(newCollection ?? {})
            };

            if (Object.keys(inferredCollection.properties ?? {}).length > 0) {
                values.properties = inferredCollection.properties as PropertiesOrBuilders<M>;
                values.propertiesOrder = inferredCollection.propertiesOrder as Extract<keyof M, string>[];
            }

            if (!values.propertiesOrder) {
                values.propertiesOrder = Object.keys(values.properties) as Extract<keyof M, string>[];
                return values;
            }

            setCollection(values);
            console.log("Inferred collection", {
                newCollection: newCollection ?? {},
                values
            });
            return values;
        } catch (e: any) {
            console.error(e);
            snackbarController.open({
                type: "error",
                message: "Error inferring collection: " + (e.message ?? "Details in the console")
            });
            return newCollection;
        }
    }, [parentCollectionIds, doCollectionInference]);

    const onSubmit = (newCollectionState: PersistedCollection<M>, formikHelpers: FormikHelpers<PersistedCollection<M>>) => {
        try {

            console.log("Submitting collection", newCollectionState)
            if (!isNewCollection) {
                saveCollection(newCollectionState).then(() => {
                    formikHelpers.resetForm({ values: initialValues });
                    // setNextMode();
                    handleClose(newCollectionState);
                });
                return;
            }

            if (currentView === "welcome") {
                setNextMode();
                formikHelpers.resetForm({ values: newCollectionState });
            } else if (currentView === "details") {
                if (extraView || importConfig.inUse) {
                    formikHelpers.resetForm({ values: newCollectionState });
                    setNextMode();
                } else if (isNewCollection) {
                    inferCollectionFromData(newCollectionState)
                        .then((values) => {
                            formikHelpers.resetForm({
                                values: values ?? newCollectionState,
                                touched: {
                                    path: true,
                                    name: true
                                }
                            });
                        }).finally(() => {
                        setNextMode();
                    });
                } else {
                    formikHelpers.resetForm({ values: newCollectionState });
                    setNextMode();
                }
            } else if (currentView === "extra_view") {
                setNextMode();
                formikHelpers.resetForm({ values: newCollectionState });
            } else if (currentView === "import_data_mapping") {
                setNextMode();
            } else if (currentView === "import_data_preview") {
                setNextMode();
            } else if (currentView === "properties") {
                saveCollection(newCollectionState).then(() => {
                    formikHelpers.resetForm({ values: initialValues });
                    setNextMode();
                    handleClose(newCollectionState);
                });
            } else {
                setNextMode();
                formikHelpers.resetForm({ values: newCollectionState });
            }
        } catch (e: any) {
            snackbarController.open({
                type: "error",
                message: "Error persisting collection: " + (e.message ?? "Details in the console")
            });
            console.error(e);
            formikHelpers.resetForm({ values: newCollectionState });
        }
    };

    if (!isNewCollection && (!navigation.initialised || !initialLoadingCompleted)) {
        return <CircularProgressCenter/>;
    }

    return <DialogContent fullHeight={true}>
        <Formik
            initialValues={initialValues}
            validationSchema={(currentView === "properties" || currentView === "subcollections" || currentView === "details") && YupSchema}
            validate={(v) => {
                if (currentView === "properties") {
                    // return the errors for the properties form
                    return propertyErrorsRef.current;
                }
                const errors: Record<string, any> = {};
                if (currentView === "details") {
                    const pathError = validatePath(v.path, isNewCollection, existingPaths, v.id);
                    if (pathError) {
                        errors.path = pathError;
                    }
                    const idError = validateId(v.id, isNewCollection, existingPaths, existingIds);
                    if (idError) {
                        errors.id = idError;
                    }
                }
                return errors;
            }}
            onSubmit={onSubmit}
        >
            {(formikHelpers) => {
                const {
                    values,
                    errors,
                    setFieldValue,
                    isSubmitting,
                    dirty,
                    submitCount
                } = formikHelpers;

                const path = values.path ?? editedCollectionPath;
                const updatedFullPath = fullPath?.includes("/") ? fullPath?.split("/").slice(0, -1).join("/") + "/" + path : path; // TODO: this path is wrong
                const pathError = validatePath(path, isNewCollection, existingPaths, values.id);

                const parentPaths = !pathError && parentCollectionIds ? navigation.convertIdsToPaths(parentCollectionIds) : undefined;
                const resolvedPath = !pathError ? navigation.resolveAliasesFrom(updatedFullPath) : undefined;
                const getDataWithPath = resolvedPath && getData ? () => getData(resolvedPath, parentPaths ?? []) : undefined;

                // eslint-disable-next-line react-hooks/rules-of-hooks
                useEffect(() => {
                    setFormDirty(dirty);
                }, [dirty]);

                function onImportDataSet(data: object[]) {
                    importConfig.setInUse(true);
                    buildEntityPropertiesFromData(data, getInferenceType)
                        .then((properties) => {
                            const res = cleanPropertiesFromImport(properties);

                            setFieldValue("properties", res.properties);
                            setFieldValue("propertiesOrder", Object.keys(res.properties));

                            importConfig.setIdColumn(res.idColumn);
                            importConfig.setImportData(data);
                            importConfig.setHeadersMapping(res.headersMapping);
                            importConfig.setOriginProperties(res.properties);
                        });
                }

                const validValues = Boolean(values.name) && Boolean(values.id);

                const onImportMappingComplete = () => {
                    const updatedProperties = { ...values.properties };
                    if (importConfig.idColumn)
                        delete updatedProperties[importConfig.idColumn];
                    setFieldValue("properties", updatedProperties);
                    // setFieldValue("propertiesOrder", Object.values(importConfig.headersMapping));
                    setNextMode();
                };

                const editable = collection?.editable === undefined || collection?.editable === true;
                const collectionEditable = editable || isNewCollection;
                return (
                    <>
                        {!isNewCollection && <Tabs value={currentView}
                                                   className={cn(defaultBorderMixin, "justify-end bg-gray-50 dark:bg-gray-950 border-b")}
                                                   onValueChange={(v) => setCurrentView(v as EditorView)}>
                            <Tab value={"details"}>
                                Details
                            </Tab>
                            <Tab value={"properties"}>
                                Properties
                            </Tab>
                            <Tab value={"subcollections"}>
                                Additional views
                            </Tab>
                        </Tabs>}

                        <Form noValidate
                              className={cn(
                                  isNewCollection ? "h-full" : "h-[calc(100%-48px)]",
                                  "flex-grow flex flex-col relative")}>

                            {currentView === "loading" &&
                                <CircularProgressCenter/>}

                            {currentView === "extra_view" &&
                                path &&
                                extraView?.View &&
                                <extraView.View path={path}/>}

                            {currentView === "welcome" &&
                                <CollectionEditorWelcomeView
                                    path={path}
                                    onContinue={(data) => {
                                        if (data) {
                                            onImportDataSet(data);
                                            setCurrentView("import_data_mapping");
                                        } else {
                                            setCurrentView("details");
                                        }
                                    }}
                                    collections={collections}
                                    parentCollection={parentCollection}
                                    pathSuggestions={pathSuggestions}/>}

                            {currentView === "import_data_mapping" && importConfig &&
                                <CollectionEditorImportMapping importConfig={importConfig}
                                                               collectionEditable={collectionEditable}
                                                               propertyConfigs={propertyConfigs}/>}

                            {currentView === "import_data_preview" && importConfig &&
                                <CollectionEditorImportDataPreview importConfig={importConfig}
                                                                   properties={values.properties as Properties}
                                                                   propertiesOrder={values.propertiesOrder as string[]}/>}

                            {currentView === "import_data_saving" && importConfig &&
                                <ImportSaveInProgress importConfig={importConfig}
                                                      collection={values}
                                                      onImportSuccess={(importedCollection) => {
                                                          handleClose(importedCollection);
                                                          snackbarController.open({
                                                              type: "info",
                                                              message: "Data imported successfully"
                                                          });
                                                      }}
                                />}

                            {currentView === "details" &&
                                <CollectionDetailsForm
                                    existingPaths={existingPaths}
                                    existingIds={existingIds}
                                    groups={groups}
                                    parentCollectionIds={parentCollectionIds}
                                    parentCollection={parentCollection}
                                    isNewCollection={isNewCollection}/>}

                            {currentView === "subcollections" && collection &&
                                <SubcollectionsEditTab
                                    parentCollection={parentCollection}
                                    configController={configController}
                                    getUser={getUser}
                                    collectionInference={collectionInference}
                                    parentCollectionIds={parentCollectionIds}
                                    collection={collection}/>}

                            {currentView === "properties" &&
                                <CollectionPropertiesEditorForm
                                    showErrors={submitCount > 0}
                                    isNewCollection={isNewCollection}
                                    reservedGroups={reservedGroups}
                                    onPropertyError={(propertyKey, namespace, error) => {
                                        propertyErrorsRef.current = removeUndefined({
                                            ...propertyErrorsRef.current,
                                            [propertyKey]: error
                                        }, true);
                                    }}
                                    getUser={getUser}
                                    getData={getDataWithPath}
                                    doCollectionInference={doCollectionInference}
                                    propertyConfigs={propertyConfigs}
                                    collectionEditable={collectionEditable}
                                    extraIcon={extraView?.icon &&
                                        <IconButton
                                            color={"primary"}
                                            onClick={() => setCurrentView("extra_view")}>
                                            {extraView.icon}
                                        </IconButton>}/>
                            }

                            {currentView !== "welcome" && <DialogActions
                                position={"absolute"}>
                                {error && <ErrorView error={error}/>}

                                {isNewCollection && includeTemplates && currentView === "import_data_mapping" &&
                                    <Button variant={"text"}
                                            type="button"
                                            onClick={() => {
                                                importConfig.setInUse(false);
                                                return setCurrentView("welcome");
                                            }}>
                                        <ArrowBackIcon/>
                                        Back
                                    </Button>}

                                {isNewCollection && includeTemplates && currentView === "import_data_preview" &&
                                    <Button variant={"text"}
                                            type="button"
                                            onClick={() => {
                                                saveCollection(values);
                                                setCurrentView("import_data_mapping");
                                            }}>
                                        <ArrowBackIcon/>
                                        Back
                                    </Button>}

                                {isNewCollection && includeTemplates && currentView === "details" &&
                                    <Button variant={"text"}
                                            type="button"
                                            onClick={() => setCurrentView("welcome")}>
                                        <ArrowBackIcon/>
                                        Back
                                    </Button>}

                                {isNewCollection && currentView === "properties" && <Button variant={"text"}
                                                                                            type="button"
                                                                                            onClick={() => setCurrentView("details")}>
                                    <ArrowBackIcon/>
                                    Back
                                </Button>}

                                <Button variant={"text"}
                                        onClick={() => {
                                            handleCancel();
                                        }}>
                                    Cancel
                                </Button>

                                {isNewCollection && currentView === "import_data_mapping" &&
                                    <Button
                                        variant={"filled"}
                                        color="primary"
                                        onClick={onImportMappingComplete}
                                    >
                                        Next
                                    </Button>}

                                {isNewCollection && currentView === "import_data_preview" &&
                                    <Button
                                        variant={"filled"}
                                        color="primary"
                                        onClick={() => {
                                            setNextMode();
                                        }}
                                    >
                                        Next
                                    </Button>}

                                {isNewCollection && (currentView === "details" || currentView === "properties") &&
                                    <LoadingButton
                                        variant={"filled"}
                                        color="primary"
                                        type="submit"
                                        loading={isSubmitting}
                                        disabled={isSubmitting || (currentView === "details" && !validValues)}
                                        startIcon={currentView === "properties"
                                            ? <DoneIcon/>
                                            : undefined}
                                    >
                                        {currentView === "details" && "Next"}
                                        {currentView === "properties" && "Create collection"}
                                    </LoadingButton>}

                                {!isNewCollection && <LoadingButton
                                    variant="filled"
                                    color="primary"
                                    type="submit"
                                    loading={isSubmitting}
                                    // disabled={isSubmitting || !dirty}
                                >
                                    Update collection
                                </LoadingButton>}

                            </DialogActions>}
                        </Form>
                    </>
                );
            }}

        </Formik>
    </DialogContent>

}

function applyPropertyConfigs<M extends Record<string, any> = any>(collection: PersistedCollection<M>, propertyConfigs: Record<string, PropertyConfig<any>>): PersistedCollection<M> {
    const { properties, ...rest } = collection;
    const propertiesResult: PropertiesOrBuilders<any> = {};
    Object.keys(properties).forEach((key) => {
        propertiesResult[key] = applyPropertiesConfig(properties[key] as PropertyOrBuilder, propertyConfigs);
    });

    return { ...rest, properties: propertiesResult };
}

function applyPropertiesConfig(property: PropertyOrBuilder, propertyConfigs: Record<string, PropertyConfig<any>>) {
    let internalProperty = property;
    if (propertyConfigs && typeof internalProperty === "object" && internalProperty.propertyConfig) {
        const propertyConfig = propertyConfigs[internalProperty.propertyConfig];
        if (propertyConfig && isPropertyBuilder(propertyConfig.property)) {
            internalProperty = propertyConfig.property;
        } else {

            if (propertyConfig) {
                internalProperty = mergeDeep(propertyConfig.property, internalProperty);
            }

            if (!isPropertyBuilder(internalProperty) && internalProperty.dataType === "map" && internalProperty.properties) {
                const properties: Record<string, PropertyOrBuilder> = {};
                Object.keys(internalProperty.properties).forEach((key) => {
                    properties[key] = applyPropertiesConfig(((internalProperty as MapProperty).properties as Properties)[key] as Property, propertyConfigs);
                });
                internalProperty = { ...internalProperty, properties };
            }

        }
    }
    return internalProperty;

}

const validatePath = (value: string, isNewCollection: boolean, existingPaths: string[], idValue?: string) => {
    let error;
    if (!value) {
        error = "You must specify a path in the database for this collection";
    }
    // if (isNewCollection && existingIds?.includes(value.trim().toLowerCase()))
    //     error = "There is already a collection which uses this path as an id";
    if (isNewCollection && existingPaths?.includes(value.trim().toLowerCase()) && !idValue)
        error = "There is already a collection with the specified path. If you want to have multiple collections referring to the same database path, make sure the have different ids";

    const subpaths = removeInitialAndTrailingSlashes(value).split("/");
    if (subpaths.length % 2 === 0) {
        error = `Collection paths must have an odd number of segments: ${value}`;
    }
    return error;
};

const validateId = (value: string, isNewCollection: boolean, existingPaths: string[], existingIds: string[]) => {
    if (!value) return undefined;
    let error;
    if (isNewCollection && existingPaths?.includes(value.trim().toLowerCase()))
        error = "There is already a collection that uses this value as a path";
    if (isNewCollection && existingIds?.includes(value.trim().toLowerCase()))
        error = "There is already a collection which uses this id";
    // if (error) {
    //     setAdvancedPanelExpanded(true);
    // }
    return error;
};
