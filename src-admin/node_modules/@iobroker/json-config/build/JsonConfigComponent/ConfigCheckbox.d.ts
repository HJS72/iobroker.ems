import { type JSX } from 'react';
import type { ConfigItemCheckbox } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCheckboxProps extends ConfigGenericProps {
    schema: ConfigItemCheckbox;
}
declare class ConfigCheckbox extends ConfigGeneric<ConfigCheckboxProps, ConfigGenericState> {
    renderItem(error: unknown, disabled: boolean): JSX.Element;
}
export default ConfigCheckbox;
