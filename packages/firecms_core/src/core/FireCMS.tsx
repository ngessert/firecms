import React, { useMemo } from "react";

import { EntityCollection, FireCMSContext, FireCMSPlugin, FireCMSProps, User } from "../types";
import { BreadcrumbsProvider } from "../contexts/BreacrumbsContext";
import { ModeControllerContext } from "../contexts/ModeController";
import { useBuildSideEntityController } from "../internal/useBuildSideEntityController";
import { useBuildNavigationContext } from "../internal/useBuildNavigationContext";
import { useBuildSideDialogsController } from "../internal/useBuildSideDialogsController";
import { FireCMSContextInstance, useFireCMSContext, useModeController } from "../hooks";
import { ErrorView } from "../components";
import { StorageSourceContext } from "../contexts/StorageSourceContext";
import { UserConfigurationPersistenceContext } from "../contexts/UserConfigurationPersistenceContext";
import { DataSourceContext } from "../contexts/DataSourceContext";
import { SideEntityControllerContext } from "../contexts/SideEntityControllerContext";
import { NavigationContextInstance } from "../contexts/NavigationContext";
import { AuthControllerContext } from "../contexts/AuthControllerContext";
import { SideDialogsControllerContext } from "../contexts/SideDialogsControllerContext";
import { useLocaleConfig } from "../internal/useLocaleConfig";
import { CenteredView } from "../ui";
import { DialogsProvider } from "../contexts/DialogsProvider";

const DEFAULT_BASE_PATH = "/";
const DEFAULT_COLLECTION_PATH = "/c";

/**
 * If you are using independent components of the CMS
 * you need to wrap them with this main component, so the internal hooks work.
 *
 * This is the main component of FireCMS. It acts as the provider of all the
 * internal contexts and hooks.
 *
 * You only need to use this component if you are building a custom app.
 *
 * @constructor
 * @group Core
 */
export function FireCMS<UserType extends User, EC extends EntityCollection>(props: FireCMSProps<UserType, EC>) {

    const modeController = useModeController();
    const {
        children,
        collections,
        views,
        entityLinkBuilder,
        userConfigPersistence,
        dateTimeFormat,
        locale,
        authController,
        storageSource,
        dataSource,
        basePath = DEFAULT_BASE_PATH,
        baseCollectionPath = DEFAULT_COLLECTION_PATH,
        plugins,
        onAnalyticsEvent,
        propertyConfigs,
        entityViews,
        components
    } = props;

    useLocaleConfig(locale);

    const navigation = useBuildNavigationContext({
        basePath,
        baseCollectionPath,
        authController,
        collections,
        views,
        userConfigPersistence,
        dataSource,
        plugins
    });

    const sideDialogsController = useBuildSideDialogsController();
    const sideEntityController = useBuildSideEntityController(navigation, sideDialogsController);

    const pluginsLoading = plugins?.some(p => p.loading) ?? false;

    const loading = authController.initialLoading || navigation.loading || pluginsLoading;

    const context: Partial<FireCMSContext> = useMemo(() => ({
        entityLinkBuilder,
        dateTimeFormat,
        locale,
        plugins,
        onAnalyticsEvent,
        entityViews: entityViews ?? [],
        propertyConfigs: propertyConfigs ?? {},
        components
    }), [dateTimeFormat, locale, plugins, entityViews, propertyConfigs, components]);

    if (navigation.navigationLoadingError) {
        return (
            <CenteredView maxWidth={"md"} fullScreen={true}>
                <ErrorView
                    title={"Error loading navigation"}
                    error={navigation.navigationLoadingError}/>
            </CenteredView>
        );
    }

    if (authController.authError) {
        return (
            <CenteredView maxWidth={"md"} fullScreen={true}>
                <ErrorView
                    title={"Error loading auth"}
                    error={authController.authError}/>
            </CenteredView>
        );
    }

    return (
        <ModeControllerContext.Provider value={modeController}>
            <FireCMSContextInstance.Provider value={context}>
                <UserConfigurationPersistenceContext.Provider
                    value={userConfigPersistence}>
                    <StorageSourceContext.Provider
                        value={storageSource}>
                        <DataSourceContext.Provider
                            value={dataSource}>
                            <AuthControllerContext.Provider
                                value={authController}>
                                <SideDialogsControllerContext.Provider
                                    value={sideDialogsController}>
                                    <SideEntityControllerContext.Provider
                                        value={sideEntityController}>
                                        <NavigationContextInstance.Provider
                                            value={navigation}>
                                            <BreadcrumbsProvider>
                                                <DialogsProvider>
                                                    <FireCMSInternal
                                                        loading={loading}>
                                                        {children}
                                                    </FireCMSInternal>
                                                </DialogsProvider>
                                            </BreadcrumbsProvider>
                                        </NavigationContextInstance.Provider>
                                    </SideEntityControllerContext.Provider>
                                </SideDialogsControllerContext.Provider>
                            </AuthControllerContext.Provider>
                        </DataSourceContext.Provider>
                    </StorageSourceContext.Provider>
                </UserConfigurationPersistenceContext.Provider>
            </FireCMSContextInstance.Provider>
        </ModeControllerContext.Provider>
    );
}

function FireCMSInternal({
                             loading,
                             children
                         }: {
    loading: boolean;
    children: (props: {
        context: FireCMSContext;
        loading: boolean;
    }) => React.ReactNode;
}) {

    const context = useFireCMSContext();
    let childrenResult = children({
        context,
        loading
    });

    const plugins = context.plugins;
    if (!loading && plugins) {
        plugins.forEach((plugin: FireCMSPlugin) => {
            if (plugin.provider) {
                childrenResult = (
                    <plugin.provider.Component {...plugin.provider.props}
                                               context={context}>
                        {childrenResult}
                    </plugin.provider.Component>
                );
            }
        });
    }

    return <>{childrenResult}</>;
}