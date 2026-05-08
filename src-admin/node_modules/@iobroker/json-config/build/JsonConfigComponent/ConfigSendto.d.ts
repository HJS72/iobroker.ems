import { type JSX } from 'react';
import type { ConfigItemSendTo } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigSendToProps extends ConfigGenericProps {
    schema: ConfigItemSendTo;
}
interface ConfigSendToState extends ConfigGenericState {
    _error: string;
    _message: string;
    hostname: string;
    running?: boolean;
}
declare class ConfigSendto extends ConfigGeneric<ConfigSendToProps, ConfigSendToState> {
    componentDidMount(): Promise<void>;
    renderErrorDialog(): JSX.Element | null;
    renderMessageDialog(): JSX.Element | null;
    _onClick(): void;
    renderDialogConfirm(): JSX.Element | null;
    renderItem(error: Error | undefined, disabled: boolean): JSX.Element;
}
export default ConfigSendto;
