import { type JSX } from 'react';
import type { ConfigItemTimePicker } from '../types';
import ConfigGeneric, { type ConfigGenericProps } from './ConfigGeneric';
interface ConfigTimePickerProps extends ConfigGenericProps {
    schema: ConfigItemTimePicker;
    dialogName?: string;
}
export default class ConfigTimePicker extends ConfigGeneric<ConfigTimePickerProps> {
    componentDidMount(): void;
    renderItem(_error: unknown, disabled: boolean): JSX.Element;
}
export {};
