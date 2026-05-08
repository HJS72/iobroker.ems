import { type JSX } from 'react';
import type { ConfigItemPort } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface Port {
    name: string;
    port: number;
    bind: string;
    v6bind: string;
    enabled: boolean;
}
interface ConfigPortProps extends ConfigGenericProps {
    schema: ConfigItemPort;
}
interface ConfigPortState extends ConfigGenericState {
    _value: string;
    oldValue: string | null;
    ports: Port[];
}
declare class ConfigPort extends ConfigGeneric<ConfigPortProps, ConfigPortState> {
    private updateTimeout?;
    componentDidMount(): Promise<void>;
    static getDerivedStateFromProps(props: ConfigPortProps, state: ConfigPortState): Partial<ConfigPortState> | null;
    checkValue(value: string): string | null;
    renderItem(error: unknown, disabled: boolean): JSX.Element;
}
export default ConfigPort;
