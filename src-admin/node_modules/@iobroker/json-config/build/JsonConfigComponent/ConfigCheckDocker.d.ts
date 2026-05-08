import { type JSX } from 'react';
import type { ConfigItemCheckDocker } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCheckDockerState extends ConfigGenericState {
    version: string;
    errorDocker: string;
    requesting: boolean;
}
interface ConfigCheckDockerProps extends ConfigGenericProps {
    schema: ConfigItemCheckDocker;
}
declare class ConfigCheckDocker extends ConfigGeneric<ConfigCheckDockerProps, ConfigCheckDockerState> {
    componentDidMount(): Promise<void>;
    renderItem(error: unknown, disabled: boolean): JSX.Element;
}
export default ConfigCheckDocker;
