import { type JSX } from 'react';
import type { ConfigItemSetState } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemSetState;
}
declare class ConfigSetState extends ConfigGeneric<ConfigInstanceSelectProps, ConfigGenericState> {
    _onClick(): Promise<void>;
    renderDialogConfirm(): JSX.Element | null;
    renderItem(_error: string, disabled: boolean): JSX.Element | null;
}
export default ConfigSetState;
