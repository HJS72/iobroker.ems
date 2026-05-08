import { type JSX } from 'react';
import type { ConfigItemSelectSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigSelectSendToProps extends ConfigGenericProps {
    schema: ConfigItemSelectSendTo;
}
interface ConfigSelectSendToState extends ConfigGenericState {
    list?: {
        label: string;
        value: string;
        hidden?: boolean;
        group?: boolean;
    }[];
    running?: boolean;
}
declare class ConfigSelectSendTo extends ConfigGeneric<ConfigSelectSendToProps, ConfigSelectSendToState> {
    private initialized;
    private localContext;
    askInstance(): void;
    getContext(): string;
    _getValue(): string | string[];
    renderItem(error: unknown, disabled: boolean): JSX.Element | string;
}
export default ConfigSelectSendTo;
