import { type JSX } from 'react';
import type { ConfigItemCRON } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCRONProps extends ConfigGenericProps {
    schema: ConfigItemCRON;
}
interface ConfigCRONState extends ConfigGenericState {
    showDialog?: boolean;
}
declare class ConfigCRON extends ConfigGeneric<ConfigCRONProps, ConfigCRONState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigCRON;
