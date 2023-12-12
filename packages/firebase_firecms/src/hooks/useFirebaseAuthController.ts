import { useCallback, useEffect, useMemo, useState } from "react";

import {
    createUserWithEmailAndPassword as createUserWithEmailAndPasswordFirebase,
    fetchSignInMethodsForEmail as fetchSignInMethodsForEmailFirebase,
    getAuth,
    GoogleAuthProvider,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    User as FirebaseUser,
    OAuthProvider,
    Auth,
    FacebookAuthProvider,
    GithubAuthProvider,
    TwitterAuthProvider,
    signInAnonymously,
    ApplicationVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
    onAuthStateChanged
} from "firebase/auth";
import { FirebaseApp } from "firebase/app";
import { FirebaseAuthController, FirebaseSignInOption, FirebaseSignInProvider, Role } from "../types";

interface FirebaseAuthControllerProps {
    firebaseApp?: FirebaseApp;
    signInOptions?: Array<FirebaseSignInProvider | FirebaseSignInOption>; // TODO
    onSignOut?: () => void;
}

/**
 * Use this hook to build an {@link AuthController} based on Firebase Auth
 * @group Firebase
 */
export const useFirebaseAuthController = ({
                                              firebaseApp,
                                              signInOptions,
                                              onSignOut: onSignOutProp
                                          }: FirebaseAuthControllerProps): FirebaseAuthController => {

    const [loggedUser, setLoggedUser] = useState<FirebaseUser | null | undefined>(undefined); // logged user, anonymous or logged out
    const [authError, setAuthError] = useState<any>();
    const [authProviderError, setAuthProviderError] = useState<any>();
    const [authLoading, setAuthLoading] = useState(true);
    const [loginSkipped, setLoginSkipped] = useState<boolean>(false);
    const [confirmationResult, setConfirmationResult] = useState<undefined | ConfirmationResult>();

    const [userRoles, setUserRoles] = useState<Role[] | null>(null);

    useEffect(() => {
        if (!firebaseApp) return;
        try {
            const auth = getAuth(firebaseApp);
            setAuthError(undefined);
            setLoggedUser(auth.currentUser)
            return onAuthStateChanged(
                auth,
                updateUser,
                error => setAuthProviderError(error)
            );
        } catch (e) {
            setAuthError(e);
            return () => {
            };
        }
    }, [firebaseApp]);

    const getProviderOptions = useCallback((providerId: FirebaseSignInProvider): FirebaseSignInOption | undefined => {
        return signInOptions?.find((option) => {
            if (option === null) throw Error("useFirebaseAuthController");
            if (typeof option === "object" && option.provider === providerId)
                return option as FirebaseSignInOption;
            return undefined;
        }) as FirebaseSignInOption | undefined;
    }, [signInOptions]);

    const googleLogin = useCallback(() => {
        const provider = new GoogleAuthProvider();
        const options = getProviderOptions("google.com");
        if (options?.scopes)
            options.scopes.forEach((scope) => provider.addScope(scope));
        if (options?.customParameters)
            provider.setCustomParameters(options.customParameters);
        const auth = getAuth(firebaseApp);
        signInWithPopup(auth, provider).catch(setAuthProviderError);
    }, [getProviderOptions]);

    const getAuthToken = useCallback(async (): Promise<string> => {
        if (!loggedUser)
            throw Error("No client user is logged in");
        return loggedUser.getIdToken();
    }, [loggedUser]);

    const emailPasswordLogin = useCallback((email: string, password: string) => {
        const auth = getAuth(firebaseApp);
        setAuthLoading(true);
        signInWithEmailAndPassword(auth, email, password)
            .catch(setAuthProviderError)
            .then(() => setAuthLoading(false));
    }, []);

    const createUserWithEmailAndPassword = useCallback((email: string, password: string) => {
        const auth = getAuth(firebaseApp);
        setAuthLoading(true);
        createUserWithEmailAndPasswordFirebase(auth, email, password)
            .catch(setAuthProviderError)
            .then(() => setAuthLoading(false));
    }, []);

    const fetchSignInMethodsForEmail = useCallback((email: string): Promise<string[]> => {
        const auth = getAuth(firebaseApp);
        setAuthLoading(true);
        return fetchSignInMethodsForEmailFirebase(auth, email)
            .then((res) => {
                setAuthLoading(false);
                return res;
            });
    }, []);

    const onSignOut = useCallback(() => {
        const auth = getAuth(firebaseApp);
        signOut(auth)
            .then(_ => {
                setLoggedUser(null);
                setAuthProviderError(null);
                onSignOutProp && onSignOutProp();
            });
        setLoginSkipped(false);
    }, [firebaseApp, onSignOutProp]);

    const updateUser = useCallback((user: FirebaseUser | null) => {
        setLoggedUser(user);
        setAuthLoading(false);
    }, []);

    const doOauthLogin = useCallback((auth: Auth, provider: OAuthProvider | FacebookAuthProvider | GithubAuthProvider | TwitterAuthProvider) => {
        setAuthLoading(true);
        signInWithPopup(auth, provider)
            .catch(setAuthProviderError).then(() => setAuthLoading(false));
    }, []);

    const anonymousLogin = useCallback(() => {
        const auth = getAuth();
        setAuthLoading(true);
        signInAnonymously(auth)
            .catch(setAuthProviderError)
            .then(() => setAuthLoading(false));
    }, []);

    const phoneLogin = useCallback((phone: string, applicationVerifier: ApplicationVerifier) => {
        const auth = getAuth();
        setAuthLoading(true);
        return signInWithPhoneNumber(auth, phone, applicationVerifier)
            .catch(setAuthProviderError)
            .then((res) => {
                setAuthLoading(false);
                setConfirmationResult(res ?? undefined);
            });
    }, []);

    const appleLogin = useCallback(() => {
        const provider = new OAuthProvider("apple.com");
        const options = getProviderOptions("apple.com");
        if (options?.scopes)
            options.scopes.forEach((scope) => provider.addScope(scope));
        if (options?.customParameters)
            provider.setCustomParameters(options.customParameters);
        const auth = getAuth();
        doOauthLogin(auth, provider);
    }, [doOauthLogin, getProviderOptions]);

    const facebookLogin = useCallback(() => {
        const provider = new FacebookAuthProvider();
        const options = getProviderOptions("facebook.com");
        if (options?.scopes)
            options.scopes.forEach((scope) => provider.addScope(scope));
        if (options?.customParameters)
            provider.setCustomParameters(options.customParameters);
        const auth = getAuth();
        doOauthLogin(auth, provider);
    }, [doOauthLogin, getProviderOptions]);

    const githubLogin = useCallback(() => {
        const provider = new GithubAuthProvider();
        const options = getProviderOptions("github.com");
        if (options?.scopes)
            options.scopes.forEach((scope) => provider.addScope(scope));
        if (options?.customParameters)
            provider.setCustomParameters(options.customParameters);
        const auth = getAuth();
        doOauthLogin(auth, provider);
    }, [doOauthLogin, getProviderOptions]);

    const microsoftLogin = useCallback(() => {
        const provider = new OAuthProvider("microsoft.com");
        const options = getProviderOptions("microsoft.com");
        if (options?.scopes)
            options.scopes.forEach((scope) => provider.addScope(scope));
        if (options?.customParameters)
            provider.setCustomParameters(options.customParameters);
        const auth = getAuth();
        doOauthLogin(auth, provider);
    }, [doOauthLogin, getProviderOptions]);

    const twitterLogin = useCallback(() => {
        const provider = new TwitterAuthProvider();
        const options = getProviderOptions("twitter.com");
        if (options?.customParameters)
            provider.setCustomParameters(options.customParameters);
        const auth = getAuth();
        doOauthLogin(auth, provider);
    }, [doOauthLogin, getProviderOptions]);

    console.log({
        authLoading,
    })

    return {
        user: loggedUser ?? null,
        setUser: updateUser,
        authProviderError,
        authLoading,
        initialLoading: authLoading,
        signOut: onSignOut,
        getAuthToken,
        googleLogin,
        loginSkipped: false,
        userRoles,
        setUserRoles,
        emailPasswordLogin,
        createUserWithEmailAndPassword,
        fetchSignInMethodsForEmail,
        anonymousLogin,
        phoneLogin,
        appleLogin,
        facebookLogin,
        githubLogin,
        microsoftLogin,
        twitterLogin,
        confirmationResult
    };
};
