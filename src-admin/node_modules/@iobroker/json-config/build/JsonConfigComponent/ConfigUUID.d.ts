import { type JSX } from 'react';
import type { ConfigItemUUID } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigUUIDProps extends ConfigGenericProps {
    schema: ConfigItemUUID;
}
interface ConfigUUIDState extends ConfigGenericState {
    uuid?: string;
}
export default class ConfigUUID extends ConfigGeneric<ConfigUUIDProps, ConfigUUIDState> {
    componentDidMount(): Promise<void>;
    renderItem(error: unknown, disabled: boolean): JSX.Element;
}
export {};
