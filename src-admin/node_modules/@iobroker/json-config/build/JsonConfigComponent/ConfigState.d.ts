import { type JSX } from 'react';
import type { ConfigItemState } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigStateProps extends ConfigGenericProps {
    schema: ConfigItemState;
}
interface ConfigStateState extends ConfigGenericState {
    stateValue?: string | number | boolean | null;
    controlType?: 'text' | 'html' | 'input' | 'slider' | 'select' | 'button' | 'switch' | 'number';
    obj?: ioBroker.Object | null;
}
declare class ConfigState extends ConfigGeneric<ConfigStateProps, ConfigStateState> {
    controlTimeout: ReturnType<typeof setTimeout> | null;
    delayedUpdate: {
        timer: ReturnType<typeof setTimeout> | null;
        value: string | boolean | number | null;
    };
    getObjectID(): string;
    componentDidMount(): Promise<void>;
    componentWillUnmount(): void;
    onStateChanged: (_id: string, state: ioBroker.State | null | undefined) => void;
    detectType(obj: ioBroker.StateObject): 'button' | 'switch' | 'slider' | 'input' | 'text' | 'select';
    getNormalizedStates(): {
        label: string;
        value: number | string;
        hidden?: string | boolean;
        color?: string;
    }[];
    renderItem(_error: string, disabled: boolean): JSX.Element;
}
export default ConfigState;
