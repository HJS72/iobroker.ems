import { type JSX } from 'react';
import type { ConfigItemFunc } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigFuncProps extends ConfigGenericProps {
    schema: ConfigItemFunc;
}
interface ConfigFuncState extends ConfigGenericState {
    selectOptions?: {
        value: string;
        label: string;
        obj?: ioBroker.EnumObject;
    }[];
}
declare class ConfigFunc extends ConfigGeneric<ConfigFuncProps, ConfigFuncState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element | null;
}
export default ConfigFunc;
