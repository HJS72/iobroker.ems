import { type JSX } from 'react';
import type { ConfigItemNumber } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigNumberProps extends ConfigGenericProps {
    schema: ConfigItemNumber;
}
interface ConfigNumberState extends ConfigGenericState {
    _value: string;
    oldValue: string | null;
}
declare class ConfigNumber extends ConfigGeneric<ConfigNumberProps, ConfigNumberState> {
    private updateTimeout?;
    componentDidMount(): void;
    static getDerivedStateFromProps(props: ConfigNumberProps, state: ConfigNumberState): Partial<ConfigNumberState> | null;
    checkValue(value: string): string | null;
    renderItem(error: unknown, disabled: boolean): JSX.Element | null;
}
export default ConfigNumber;
