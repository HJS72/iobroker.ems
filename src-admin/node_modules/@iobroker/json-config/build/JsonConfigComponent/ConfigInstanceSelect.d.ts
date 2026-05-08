import { type JSX } from 'react';
import type { ConfigItemInstanceSelect } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigInstanceSelectProps extends ConfigGenericProps {
    schema: ConfigItemInstanceSelect;
}
interface ConfigInstanceSelectState extends ConfigGenericState {
    selectOptions?: {
        label: string;
        value: string;
        icon?: string;
    }[];
}
declare class ConfigInstanceSelect extends ConfigGeneric<ConfigInstanceSelectProps, ConfigInstanceSelectState> {
    componentDidMount(): void;
    componentWillUnmount(): void;
    onInstancesUpdate: (id: string, obj?: ioBroker.Object | null) => void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigInstanceSelect;
