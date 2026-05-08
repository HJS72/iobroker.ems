import { type JSX } from 'react';
import type { ConfigItemText } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigColorProps extends ConfigGenericProps {
    schema: ConfigItemText;
}
interface ConfigColorState extends ConfigGenericState {
    showColorDialog?: boolean;
    colorDialogValue?: string;
}
declare class ConfigColor extends ConfigGeneric<ConfigColorProps, ConfigColorState> {
    renderColorDialog(): JSX.Element | null;
    renderItem(_error: unknown, disabled: boolean): JSX.Element;
}
export default ConfigColor;
