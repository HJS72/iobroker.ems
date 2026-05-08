import { type JSX } from 'react';
import type { ConfigItemPassword } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigPasswordProps extends ConfigGenericProps {
    schema: ConfigItemPassword;
}
interface ConfigPasswordState extends ConfigGenericState {
    _notEqual?: boolean;
    _repeat?: string;
    _visible?: boolean;
}
declare class ConfigPassword extends ConfigGeneric<ConfigPasswordProps, ConfigPasswordState> {
    componentDidMount(): void;
    onChangePassword(password?: string, repeatPassword?: string): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigPassword;
