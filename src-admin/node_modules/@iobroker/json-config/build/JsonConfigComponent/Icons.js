import React from 'react';
import { Add, Delete, Edit, Refresh, Search, Wifi, WifiOff, Visibility, LinkOff, Link as LinkIcon, NotListedLocation, PlayArrow, Stop, FastForward, FastRewind, Pause, Lightbulb, Power, Fluorescent, WbIncandescent, Settings, Group, Person, QrCode, } from '@mui/icons-material';
export default function getIconByName(name, style) {
    if (name === 'edit' || name === 'rename') {
        return React.createElement(Edit, { style: style });
    }
    if (name === 'delete') {
        return React.createElement(Delete, { style: style });
    }
    if (name === 'refresh') {
        return React.createElement(Refresh, { style: style });
    }
    if (name === 'newDevice' || name === 'new' || name === 'add') {
        return React.createElement(Add, { style: style });
    }
    if (name === 'discover' || name === 'search') {
        return React.createElement(Search, { style: style });
    }
    if (name === 'unpairDevice' || name === 'unpair') {
        return React.createElement(LinkOff, { style: style });
    }
    if (name === 'pairDevice' || name === 'pair') {
        return React.createElement(LinkIcon, { style: style });
    }
    if (name === 'identify') {
        return React.createElement(NotListedLocation, { style: style });
    }
    if (name === 'play') {
        return React.createElement(PlayArrow, { style: style });
    }
    if (name === 'stop') {
        return React.createElement(Stop, { style: style });
    }
    if (name === 'pause') {
        return React.createElement(Pause, { style: style });
    }
    if (name === 'forward' || name === 'next') {
        return React.createElement(FastForward, { style: style });
    }
    if (name === 'rewind' || name === 'previous') {
        return React.createElement(FastRewind, { style: style });
    }
    if (name === 'lamp' || name === 'light') {
        return React.createElement(Lightbulb, { style: style });
    }
    if (name === 'backlight') {
        return React.createElement(Fluorescent, { style: style });
    }
    if (name === 'dimmer') {
        return React.createElement(WbIncandescent, { style: style });
    }
    if (name === 'socket') {
        return React.createElement(Power, { style: style });
    }
    if (name === 'settings') {
        return React.createElement(Settings, { style: style });
    }
    if (name === 'users' || name === 'group') {
        return React.createElement(Group, { style: style });
    }
    if (name === 'user') {
        return React.createElement(Person, { style: style });
    }
    if (name === 'qrcode') {
        return React.createElement(QrCode, { style: style });
    }
    if (name === 'connection') {
        return React.createElement(Wifi, { style: style });
    }
    if (name === 'no-connection') {
        return React.createElement(WifiOff, { style: style });
    }
    if (name === 'visible') {
        return React.createElement(Visibility, { style: style });
    }
    return null;
}
//# sourceMappingURL=Icons.js.map