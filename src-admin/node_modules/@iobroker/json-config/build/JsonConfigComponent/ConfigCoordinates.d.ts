import { type JSX } from 'react';
import type { ConfigItemCoordinates } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigCoordinatesProps extends ConfigGenericProps {
    schema: ConfigItemCoordinates;
}
interface ConfigCoordinatesState extends ConfigGenericState {
    useSystem?: boolean;
    longitude?: string | number;
    latitude?: string | number;
}
declare class ConfigCoordinates extends ConfigGeneric<ConfigCoordinatesProps, ConfigCoordinatesState> {
    componentDidMount(): void;
    getSystemCoordinates(): Promise<void>;
    getCoordinates(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigCoordinates;
