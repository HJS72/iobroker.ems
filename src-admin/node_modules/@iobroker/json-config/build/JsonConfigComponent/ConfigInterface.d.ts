import { type JSX } from 'react';
import type { ConfigItemInterface } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInterfaceProps extends ConfigGenericProps {
    schema: ConfigItemInterface;
}
interface ConfigInterfaceState extends ConfigGenericState {
    interfaces?: {
        value: string;
        address: string;
    }[];
}
declare class ConfigInterface extends ConfigGeneric<ConfigInterfaceProps, ConfigInterfaceState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigInterface;
