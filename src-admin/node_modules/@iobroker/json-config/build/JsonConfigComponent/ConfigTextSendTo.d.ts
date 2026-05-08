import React, { type JSX } from 'react';
import type { ConfigItemSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigTextSendToProps extends ConfigGenericProps {
    schema: ConfigItemSendTo;
}
interface ConfigTextSendToState extends ConfigGenericState {
    text?: string;
    style?: React.CSSProperties;
    icon?: string;
    iconStyle?: React.CSSProperties;
}
declare class ConfigTextSendTo extends ConfigGeneric<ConfigTextSendToProps, ConfigTextSendToState> {
    private initialized;
    private localContext;
    askInstance(): void;
    getLocalContext(): string;
    renderItem(): JSX.Element;
}
export default ConfigTextSendTo;
