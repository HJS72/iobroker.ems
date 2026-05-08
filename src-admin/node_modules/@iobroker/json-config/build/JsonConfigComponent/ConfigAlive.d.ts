import { type JSX } from 'react';
import type { ConfigItemAlive } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigAliveProps extends ConfigGenericProps {
    schema: ConfigItemAlive;
}
interface ConfigAliveState extends ConfigGenericState {
    alive?: boolean | null;
    instance?: string;
}
declare class ConfigAlive extends ConfigGeneric<ConfigAliveProps, ConfigAliveState> {
    componentDidMount(): void;
    getInstance(): string;
    renderItem(): JSX.Element | null;
}
export default ConfigAlive;
