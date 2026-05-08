import { type JSX } from 'react';
import type { ConfigItemRoom } from '../types';
import ConfigGeneric, { type ConfigGenericProps, type ConfigGenericState } from './ConfigGeneric';
interface ConfigRoomProps extends ConfigGenericProps {
    schema: ConfigItemRoom;
}
interface ConfigRoomState extends ConfigGenericState {
    selectOptions?: {
        value: string;
        label: string;
        obj?: ioBroker.EnumObject;
    }[];
}
declare class ConfigRoom extends ConfigGeneric<ConfigRoomProps, ConfigRoomState> {
    componentDidMount(): void;
    renderItem(error: string, disabled: boolean): JSX.Element;
}
export default ConfigRoom;
