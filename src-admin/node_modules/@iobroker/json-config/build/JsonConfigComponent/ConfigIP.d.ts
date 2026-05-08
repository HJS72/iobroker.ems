import { type JSX } from 'react';
import type { ConfigItemIP } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigIPProps extends ConfigGenericProps {
    schema: ConfigItemIP;
}
interface ConfigIPState extends ConfigGenericState {
    ips?: {
        name: string;
        address: string;
        family: string;
        internal?: boolean;
    }[];
}
declare class ConfigIP extends ConfigGeneric<ConfigIPProps, ConfigIPState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigIP;
