import { type JSX } from 'react';
import type { ConfigItemSlider } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigSliderProps extends ConfigGenericProps {
    schema: ConfigItemSlider;
}
interface ConfigSliderState extends ConfigGenericState {
    _value: number;
}
declare class ConfigSlider extends ConfigGeneric<ConfigSliderProps, ConfigSliderState> {
    componentDidMount(): void;
    static getDerivedStateFromProps(props: ConfigSliderProps, state: ConfigSliderState): Partial<ConfigSliderState> | null;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigSlider;
