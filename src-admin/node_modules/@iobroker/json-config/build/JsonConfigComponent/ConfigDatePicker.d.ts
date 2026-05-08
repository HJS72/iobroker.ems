import { type JSX } from 'react';
import type { ConfigItemDatePicker } from '../types';
import ConfigGeneric, { type ConfigGenericProps } from './ConfigGeneric';
interface ConfigDatePickerProps extends ConfigGenericProps {
    schema: ConfigItemDatePicker;
}
export default class ConfigDatePicker extends ConfigGeneric<ConfigDatePickerProps> {
    componentDidMount(): void;
    renderItem(_error: unknown, disabled: boolean): JSX.Element;
}
export {};
