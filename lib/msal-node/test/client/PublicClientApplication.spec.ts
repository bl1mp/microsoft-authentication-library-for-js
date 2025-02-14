import {
    ID_TOKEN_CLAIMS,
    mockAuthenticationResult,
    TEST_CONSTANTS,
    TEST_DATA_CLIENT_INFO,
} from "../utils/TestConstants";
import {
    ClientConfiguration,
    AuthenticationResult,
    AuthorizationCodeClient,
    RefreshTokenClient,
    SilentFlowClient,
    ProtocolMode,
    Logger,
    LogLevel,
    ClientAuthError,
    AccountInfo,
    ServerAuthorizationCodeResponse,
} from "@azure/msal-common";
import {
    Configuration,
    DeviceCodeClient,
    ILoopbackClient,
    InteractiveRequest,
    PublicClientApplication,
    CryptoProvider,
    DeviceCodeRequest,
    AuthorizationCodeRequest,
    RefreshTokenRequest,
    AuthorizationUrlRequest,
    UsernamePasswordRequest,
    SilentFlowRequest,
    NodeStorage,
} from "../../src";
import { HttpClient } from "../../src/network/HttpClient";
import http from "http";

import * as msalNode from "../../src";
import {
    fakeAuthority,
    setupAuthorityFactory_createDiscoveredInstance_mock,
    setupServerTelemetryManagerMock,
} from "./test-fixtures";
import { getMsalCommonAutoMock, MSALCommonModule } from "../utils/MockUtils";

import { version, name } from "../../package.json";

const msalCommon: MSALCommonModule = jest.requireActual("@azure/msal-common");

jest.mock("../../src/client/DeviceCodeClient");
jest.mock("../../src/client/ClientCredentialClient");
jest.mock("../../src/client/OnBehalfOfClient");
jest.mock("../../src/client/UsernamePasswordClient");

describe("PublicClientApplication", () => {
    // @ts-ignore
    const mockTelemetryManager: msalCommon.ServerTelemetryManager =
        setupServerTelemetryManagerMock();

    let appConfig: Configuration = {
        auth: {
            clientId: TEST_CONSTANTS.CLIENT_ID,
            authority: TEST_CONSTANTS.AUTHORITY,
        },
    };

    let testAppConfig: Configuration = {
        auth: {
            clientId: TEST_CONSTANTS.CLIENT_ID,
            authority: TEST_CONSTANTS.AUTHORITY,
        },

        system: {
            loggerOptions: void 0,
        },
    };

    const expectedConfig: ClientConfiguration = {
        authOptions: {
            clientId: TEST_CONSTANTS.CLIENT_ID,
            authority: fakeAuthority,
            clientCapabilities: [],
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();

        mockTelemetryManager;
        setupAuthorityFactory_createDiscoveredInstance_mock();
    });

    test("exports a class", () => {
        const authApp = new PublicClientApplication(appConfig);
        expect(authApp).toBeInstanceOf(PublicClientApplication);
    });

    test("acquireTokenByDeviceCode", async () => {
        const request: DeviceCodeRequest = {
            deviceCodeCallback: (response) => {
                console.log(response);
            },
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
        };

        const deviceCodeClientSpy = jest.spyOn(msalNode, "DeviceCodeClient");
        const fakeAuthResult = { foo: "bar" };
        jest.spyOn(
            DeviceCodeClient.prototype,
            "acquireToken"
        ).mockImplementation(() =>
            Promise.resolve(fakeAuthResult as unknown as AuthenticationResult)
        );

        const authApp = new PublicClientApplication(appConfig);
        const result = await authApp.acquireTokenByDeviceCode(request);
        expect(deviceCodeClientSpy).toHaveBeenCalledTimes(1);
        expect(deviceCodeClientSpy).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
        expect(result).toEqual(fakeAuthResult);
    });

    test("acquireTokenByAuthorizationCode", async () => {
        const request: AuthorizationCodeRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            redirectUri: TEST_CONSTANTS.REDIRECT_URI,
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;

        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByCode(request);

        expect(AuthorizationCodeClient).toHaveBeenCalledTimes(1);
        expect(AuthorizationCodeClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireTokenByAuthorizationCode with nonce", async () => {
        const request: AuthorizationCodeRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            redirectUri: TEST_CONSTANTS.REDIRECT_URI,
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
        };

        const cryptoProvider = new CryptoProvider();
        const authCodePayLoad = {
            nonce: cryptoProvider.createNewGuid(),
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;

        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByCode(request, authCodePayLoad);

        expect(AuthorizationCodeClient).toHaveBeenCalledTimes(1);
        expect(AuthorizationCodeClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireTokenByAuthorizationCode with state validation", async () => {
        const request: AuthorizationCodeRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            redirectUri: TEST_CONSTANTS.REDIRECT_URI,
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
        };

        const cryptoProvider = new CryptoProvider();
        const authCodePayLoad = {
            nonce: cryptoProvider.createNewGuid(),
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
            state: cryptoProvider.createNewGuid(),
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;

        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByCode(request, authCodePayLoad);

        expect(AuthorizationCodeClient).toHaveBeenCalledTimes(1);
        expect(AuthorizationCodeClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireTokenByRefreshToken", async () => {
        const request: RefreshTokenRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            refreshToken: TEST_CONSTANTS.REFRESH_TOKEN,
        };

        const mockRefreshTokenClient =
            getMsalCommonAutoMock().RefreshTokenClient;
        jest.spyOn(msalCommon, "RefreshTokenClient").mockImplementation(
            (config) => new mockRefreshTokenClient(config)
        );

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByRefreshToken(request);
        expect(RefreshTokenClient).toHaveBeenCalledTimes(1);
        expect(RefreshTokenClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireTokenSilent", async () => {
        const account: AccountInfo = {
            homeAccountId: "",
            environment: "",
            tenantId: "",
            username: "",
            localAccountId: "",
            name: "",
            idTokenClaims: ID_TOKEN_CLAIMS,
        };
        const request: SilentFlowRequest = {
            account: account,
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
        };

        const silentFlowClient = getMsalCommonAutoMock().SilentFlowClient;
        jest.spyOn(msalCommon, "SilentFlowClient").mockImplementation(
            (config) => new silentFlowClient(config)
        );

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenSilent(request);
        expect(SilentFlowClient).toHaveBeenCalledTimes(1);
        expect(SilentFlowClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireTokenInteractive", async () => {
        const authApp = new PublicClientApplication(appConfig);

        let redirectUri: string;

        const openBrowser = (url: string) => {
            expect(url.startsWith("https://login.microsoftonline.com")).toBe(
                true
            );
            http.get(
                `${redirectUri}?code=${TEST_CONSTANTS.AUTHORIZATION_CODE}`
            );
            return Promise.resolve();
        };
        const request: InteractiveRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            openBrowser: openBrowser,
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;
        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        jest.spyOn(
            MockAuthorizationCodeClient.prototype,
            "getAuthCodeUrl"
        ).mockImplementation((req) => {
            redirectUri = req.redirectUri;
            return Promise.resolve(TEST_CONSTANTS.AUTH_CODE_URL);
        });

        jest.spyOn(
            MockAuthorizationCodeClient.prototype,
            "acquireToken"
        ).mockImplementation((tokenRequest) => {
            expect(tokenRequest.scopes).toEqual([
                ...TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
                ...TEST_CONSTANTS.DEFAULT_OIDC_SCOPES,
            ]);
            return Promise.resolve(mockAuthenticationResult);
        });

        const response = await authApp.acquireTokenInteractive(request);
        expect(response.idToken).toEqual(mockAuthenticationResult.idToken);
        expect(response.accessToken).toEqual(
            mockAuthenticationResult.accessToken
        );
        expect(response.account).toEqual(mockAuthenticationResult.account);
    });

    test("acquireTokenInteractive - with custom loopback client", async () => {
        const authApp = new PublicClientApplication(appConfig);

        const openBrowser = (url: string) => {
            expect(url.startsWith("https://login.microsoftonline.com")).toBe(
                true
            );
            return Promise.resolve();
        };

        const testServerCodeResponse: ServerAuthorizationCodeResponse = {
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
            client_info: TEST_DATA_CLIENT_INFO.TEST_DECODED_CLIENT_INFO,
            state: "123",
        };

        const mockListenForAuthCode = jest.fn(() => {
            return new Promise<ServerAuthorizationCodeResponse>((resolve) => {
                resolve(testServerCodeResponse);
            });
        });
        const mockGetRedirectUri = jest.fn(() => TEST_CONSTANTS.REDIRECT_URI);
        const mockCloseServer = jest.fn(() => {});

        const customLoopbackClient: ILoopbackClient = {
            listenForAuthCode: mockListenForAuthCode,
            getRedirectUri: mockGetRedirectUri,
            closeServer: mockCloseServer,
        };

        const request: InteractiveRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            openBrowser: openBrowser,
            loopbackClient: customLoopbackClient,
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;
        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        jest.spyOn(
            MockAuthorizationCodeClient.prototype,
            "getAuthCodeUrl"
        ).mockImplementation((req) => {
            expect(req.redirectUri).toEqual(TEST_CONSTANTS.REDIRECT_URI);
            return Promise.resolve(TEST_CONSTANTS.AUTH_CODE_URL);
        });

        jest.spyOn(
            MockAuthorizationCodeClient.prototype,
            "acquireToken"
        ).mockImplementation((tokenRequest) => {
            expect(tokenRequest.scopes).toEqual([
                ...TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
                ...TEST_CONSTANTS.DEFAULT_OIDC_SCOPES,
            ]);
            return Promise.resolve(mockAuthenticationResult);
        });

        const response = await authApp.acquireTokenInteractive(request);
        expect(response.idToken).toEqual(mockAuthenticationResult.idToken);
        expect(response.accessToken).toEqual(
            mockAuthenticationResult.accessToken
        );
        expect(response.account).toEqual(mockAuthenticationResult.account);
        expect(mockListenForAuthCode).toHaveBeenCalledTimes(1);
        expect(mockGetRedirectUri).toHaveBeenCalledTimes(1);
        expect(mockCloseServer).toHaveBeenCalledTimes(1);
    });

    test("initializeBaseRequest passes a claims hash to acquireToken", async () => {
        const account: AccountInfo = {
            homeAccountId: "",
            environment: "",
            tenantId: "",
            username: "",
            localAccountId: "",
            name: "",
            idTokenClaims: ID_TOKEN_CLAIMS,
        };
        const request: SilentFlowRequest = {
            account: account,
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            claims: TEST_CONSTANTS.CLAIMS,
        };

        const silentFlowClient = getMsalCommonAutoMock().SilentFlowClient;
        jest.spyOn(msalCommon, "SilentFlowClient").mockImplementation(
            (config) => new silentFlowClient(config)
        );

        const acquireTokenSpy = jest.spyOn(
            silentFlowClient.prototype,
            "acquireToken"
        );
        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenSilent(request);
        expect(silentFlowClient.prototype.acquireToken).toHaveBeenCalledWith(
            expect.objectContaining({ requestedClaimsHash: expect.any(String) })
        );

        const submittedRequest = acquireTokenSpy.mock.calls[0][0];
        expect(
            (submittedRequest as any)?.requestedClaimsHash?.length
        ).toBeGreaterThan(0);
    });

    test("create AuthorizationCode URL", async () => {
        const request: AuthorizationUrlRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            redirectUri: TEST_CONSTANTS.REDIRECT_URI,
        };

        const authApp = new PublicClientApplication(appConfig);
        await authApp.getAuthCodeUrl(request);
        expect(AuthorizationCodeClient).toHaveBeenCalledTimes(1);
        expect(AuthorizationCodeClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireTokenByUsernamePassword", async () => {
        const request: UsernamePasswordRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            username: TEST_CONSTANTS.USERNAME,
            password: TEST_CONSTANTS.PASSWORD,
        };

        const usernamePasswordClientSpy = jest.spyOn(
            msalNode,
            "UsernamePasswordClient"
        );

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByUsernamePassword(request);
        expect(usernamePasswordClientSpy).toHaveBeenCalledTimes(1);
        expect(usernamePasswordClientSpy).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireToken default authority", async () => {
        // No authority set in app configuration or request, should default to common authority
        const config: Configuration = {
            auth: {
                clientId: TEST_CONSTANTS.CLIENT_ID,
            },
        };

        const request: RefreshTokenRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            refreshToken: TEST_CONSTANTS.REFRESH_TOKEN,
        };

        const authorityMock =
            setupAuthorityFactory_createDiscoveredInstance_mock(fakeAuthority);

        const authApp = new PublicClientApplication(config);
        await authApp.acquireTokenByRefreshToken(request);
        expect(authorityMock.mock.calls[0][0]).toBe(
            TEST_CONSTANTS.DEFAULT_AUTHORITY
        );
        expect(authorityMock.mock.calls[0][1]).toBeInstanceOf(HttpClient);
        expect(authorityMock.mock.calls[0][2]).toBeInstanceOf(NodeStorage);
        expect(authorityMock.mock.calls[0][3]).toStrictEqual({
            protocolMode: ProtocolMode.AAD,
            knownAuthorities: [],
            azureRegionConfiguration: undefined,
            cloudDiscoveryMetadata: "",
            authorityMetadata: "",
            skipAuthorityMetadataCache: false,
        });
        expect(authorityMock.mock.calls[0][4]).toBeInstanceOf(Logger);
        expect(RefreshTokenClient).toHaveBeenCalledTimes(1);
        expect(RefreshTokenClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("authority overridden by acquire token request parameters", async () => {
        // Authority set on client app, but should be overridden by authority passed in request
        const request: RefreshTokenRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            refreshToken: TEST_CONSTANTS.REFRESH_TOKEN,
            authority: TEST_CONSTANTS.ALTERNATE_AUTHORITY,
        };

        const authorityMock =
            setupAuthorityFactory_createDiscoveredInstance_mock();

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByRefreshToken(request);
        expect(authorityMock.mock.calls[0][0]).toBe(
            TEST_CONSTANTS.ALTERNATE_AUTHORITY
        );
        expect(authorityMock.mock.calls[0][1]).toBeInstanceOf(HttpClient);
        expect(authorityMock.mock.calls[0][2]).toBeInstanceOf(NodeStorage);
        expect(authorityMock.mock.calls[0][3]).toStrictEqual({
            protocolMode: ProtocolMode.AAD,
            knownAuthorities: [],
            azureRegionConfiguration: undefined,
            cloudDiscoveryMetadata: "",
            authorityMetadata: "",
            skipAuthorityMetadataCache: false,
        });
        expect(authorityMock.mock.calls[0][4]).toBeInstanceOf(Logger);
        expect(RefreshTokenClient).toHaveBeenCalledTimes(1);
        expect(RefreshTokenClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireToken when azureCloudOptions are set", async () => {
        // No authority set in app configuration or request, should default to common authority
        const config: Configuration = {
            auth: {
                clientId: TEST_CONSTANTS.CLIENT_ID,
                azureCloudOptions: {
                    azureCloudInstance:
                        msalCommon.AzureCloudInstance.AzureUsGovernment,
                    tenant: "",
                },
            },
        };

        const request: RefreshTokenRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            refreshToken: TEST_CONSTANTS.REFRESH_TOKEN,
        };

        const authorityMock =
            setupAuthorityFactory_createDiscoveredInstance_mock(fakeAuthority);

        const authApp = new PublicClientApplication(config);
        await authApp.acquireTokenByRefreshToken(request);
        expect(authorityMock.mock.calls[0][0]).toBe(
            TEST_CONSTANTS.USGOV_AUTHORITY
        );
        expect(authorityMock.mock.calls[0][1]).toBeInstanceOf(HttpClient);
        expect(authorityMock.mock.calls[0][2]).toBeInstanceOf(NodeStorage);
        expect(authorityMock.mock.calls[0][3]).toStrictEqual({
            protocolMode: ProtocolMode.AAD,
            knownAuthorities: [],
            azureRegionConfiguration: undefined,
            cloudDiscoveryMetadata: "",
            authorityMetadata: "",
            skipAuthorityMetadataCache: false,
        });
        expect(authorityMock.mock.calls[0][4]).toBeInstanceOf(Logger);
        expect(RefreshTokenClient).toHaveBeenCalledTimes(1);
        expect(RefreshTokenClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("acquireToken when azureCloudOptions and authority are set", async () => {
        // No authority set in app configuration or request, should default to common authority
        const config: Configuration = {
            auth: {
                clientId: TEST_CONSTANTS.CLIENT_ID,
                authority: TEST_CONSTANTS.ALTERNATE_AUTHORITY,
                azureCloudOptions: {
                    azureCloudInstance:
                        msalCommon.AzureCloudInstance.AzureUsGovernment,
                    tenant: "",
                },
            },
        };

        const request: RefreshTokenRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            refreshToken: TEST_CONSTANTS.REFRESH_TOKEN,
        };

        const authorityMock =
            setupAuthorityFactory_createDiscoveredInstance_mock(fakeAuthority);

        const authApp = new PublicClientApplication(config);
        await authApp.acquireTokenByRefreshToken(request);
        expect(authorityMock.mock.calls[0][0]).toBe(
            TEST_CONSTANTS.USGOV_AUTHORITY
        );
        expect(authorityMock.mock.calls[0][1]).toBeInstanceOf(HttpClient);
        expect(authorityMock.mock.calls[0][2]).toBeInstanceOf(NodeStorage);
        expect(authorityMock.mock.calls[0][3]).toStrictEqual({
            protocolMode: ProtocolMode.AAD,
            knownAuthorities: [],
            azureRegionConfiguration: undefined,
            cloudDiscoveryMetadata: "",
            authorityMetadata: "",
            skipAuthorityMetadataCache: false,
        });
        expect(authorityMock.mock.calls[0][4]).toBeInstanceOf(Logger);
        expect(RefreshTokenClient).toHaveBeenCalledTimes(1);
        expect(RefreshTokenClient).toHaveBeenCalledWith(
            expect.objectContaining(expectedConfig)
        );
    });

    test("getLogger and setLogger", async () => {
        const authApp = new PublicClientApplication(appConfig);
        const logger = new Logger(
            {
                loggerCallback: (level, message, containsPii) => {
                    expect(message).toContain("Message");
                    expect(message).toContain(LogLevel.Info.toString());

                    expect(level).toEqual(LogLevel.Info);
                    expect(containsPii).toEqual(false);
                },
                piiLoggingEnabled: false,
            },
            name,
            version
        );

        authApp.setLogger(logger);

        expect(authApp.getLogger()).toEqual(logger);

        authApp.getLogger().info("Message");
    });

    test("logger undefined", async () => {
        const authApp = new PublicClientApplication(testAppConfig);

        expect(authApp.getLogger()).toBeDefined();
        expect(authApp.getLogger().info("Test logger")).toEqual(undefined);
    });

    test("should throw an error if state is not provided", async () => {
        const cryptoProvider = new CryptoProvider();
        const request: AuthorizationCodeRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            redirectUri: TEST_CONSTANTS.REDIRECT_URI,
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
            correlationId: "test-correlationId",
            state: "",
        };

        const authCodePayLoad = {
            nonce: cryptoProvider.createNewGuid(),
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
            state: cryptoProvider.createNewGuid(),
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;

        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        const mockInfo = jest.fn();
        jest.mock("@azure/msal-common", () => {
            return {
                getLogger: () => ({
                    info: mockInfo,
                }),
            };
        });

        const authApp = new PublicClientApplication(appConfig);
        await authApp.acquireTokenByCode(request, authCodePayLoad);

        try {
            await authApp.acquireTokenByCode(request, authCodePayLoad);
        } catch (e) {
            expect(mockInfo).toBeCalledWith("acquireTokenByCode called");
            expect(mockInfo).toHaveBeenCalledWith(
                "acquireTokenByCode - validating state"
            );
            expect(authApp.acquireTokenByCode).toThrow(
                "State not found. Please verify that the request originated from msal."
            );
        }
    });

    test("should throw error when state and cachedSate don't match", async () => {
        const cryptoProvider = new CryptoProvider();
        const request: AuthorizationCodeRequest = {
            scopes: TEST_CONSTANTS.DEFAULT_GRAPH_SCOPE,
            redirectUri: TEST_CONSTANTS.REDIRECT_URI,
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
            correlationId: "test-correlationId",
            state: cryptoProvider.createNewGuid(),
        };

        const authCodePayLoad = {
            nonce: cryptoProvider.createNewGuid(),
            code: TEST_CONSTANTS.AUTHORIZATION_CODE,
            state: "ed09b151-1b68-4c2c-8e95-y8dcfffffggh",
        };

        const MockAuthorizationCodeClient =
            getMsalCommonAutoMock().AuthorizationCodeClient;

        jest.spyOn(msalCommon, "AuthorizationCodeClient").mockImplementation(
            (config) => new MockAuthorizationCodeClient(config)
        );

        const mockInfo = jest.fn();
        jest.mock("@azure/msal-common", () => {
            return {
                getLogger: () => ({
                    info: mockInfo,
                }),
            };
        });

        const authApp = new PublicClientApplication(appConfig);

        await expect(
            authApp.acquireTokenByCode(request, authCodePayLoad)
        ).rejects.toMatchObject(ClientAuthError.createStateMismatchError());
    });
});
