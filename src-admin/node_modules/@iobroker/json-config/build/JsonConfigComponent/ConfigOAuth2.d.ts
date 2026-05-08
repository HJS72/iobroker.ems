import React from 'react';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import type { ConfigItemOAuth2 } from '../types';
declare global {
    interface Window {
        attachEvent: Window['addEventListener'];
        detachEvent: Window['removeEventListener'];
    }
}
interface ConfigOAuth2Props extends ConfigGenericProps {
    schema: ConfigItemOAuth2;
}
export interface AccessTokens {
    access_token: string;
    expires_in: number;
    access_token_expires_on: string;
    ext_expires_in: number;
    token_type: 'Bearer';
    scope: string;
    refresh_token: string;
}
interface ConfigOAuth2State extends ConfigGenericState {
    accessTokens: string;
    success: boolean;
    blocked: boolean;
    running: boolean;
    pressed: boolean;
}
export default class ConfigOAuth2 extends ConfigGeneric<ConfigOAuth2Props, ConfigOAuth2State> {
    private authWindow?;
    private readonly oid;
    private readonly url;
    constructor(props: ConfigOAuth2Props);
    componentDidMount(): Promise<void>;
    onTokensUpdated: (_id: string, state: ioBroker.State | null | undefined) => void;
    componentWillUnmount(): void;
    saveToken(accessTokens: string): void;
    onMessage: (event: MessageEvent) => void;
    onOpenUrl(): void;
    renderItem(): React.JSX.Element;
}
export {};
