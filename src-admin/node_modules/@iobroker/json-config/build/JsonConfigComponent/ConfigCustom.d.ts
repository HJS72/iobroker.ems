import React, { type JSX } from 'react';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
import type { ConfigItemCustom } from '../types';
interface ConfigCustomProps extends ConfigGenericProps {
    schema: ConfigItemCustom;
}
interface ConfigCustomState extends ConfigGenericState {
    Component: React.FC<ConfigGenericProps> | null;
    error: string;
}
export default class ConfigCustom extends ConfigGeneric<ConfigCustomProps, ConfigCustomState> {
    static runningLoads: Record<string, Promise<{
        default: Record<string, React.FC<ConfigGenericProps>>;
    }>>;
    constructor(props: ConfigCustomProps);
    componentDidMount(): Promise<void>;
    render(): JSX.Element;
}
export {};
