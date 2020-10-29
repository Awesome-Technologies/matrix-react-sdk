/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, {createRef} from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { _t } from '../../../languageHandler';
import {MatrixClientPeg} from '../../../MatrixClientPeg';
import RateLimitedFunc from '../../../ratelimitedfunc';

import { linkifyElement } from '../../../HtmlUtils';
import {CancelButton} from './SimpleRoomHeader';
import RoomHeaderButtons from '../right_panel/RoomHeaderButtons';
import DMRoomMap from '../../../utils/DMRoomMap';
import dis from "../../../dispatcher/dispatcher";
import Analytics from '../../../Analytics';
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import {DefaultTagID} from "../../../stores/room-list/models";
import AccessibleButton from "../elements/AccessibleButton";
import ConfirmArchiveCaseDialog from "../dialogs/ConfirmArchiveCaseDialog";
import ConfirmCloseCaseDialog from "../dialogs/ConfirmCloseCaseDialog";
import ShareDialog from "../dialogs/ShareDialog";
import Modal from "../../../Modal";


export default class RoomHeader extends React.Component {
    static propTypes = {
        room: PropTypes.object,
        oobData: PropTypes.object,
        inRoom: PropTypes.bool,
        onSettingsClick: PropTypes.func,
        onPinnedClick: PropTypes.func,
        onSearchClick: PropTypes.func,
        onLeaveClick: PropTypes.func,
        onCancelClick: PropTypes.func,
        e2eStatus: PropTypes.string,
        isCaseClosed: PropTypes.bool,
    };

    static defaultProps = {
        editing: false,
        inRoom: false,
        onCancelClick: null,
    };

    constructor(props) {
        super(props);

        this._topic = createRef();
    }

    componentDidMount() {
        const cli = MatrixClientPeg.get();
        cli.on("RoomState.events", this._onRoomStateEvents);
        cli.on("Room.accountData", this._onRoomAccountData);

        // When a room name occurs, RoomState.events is fired *before*
        // room.name is updated. So we have to listen to Room.name as well as
        // RoomState.events.
        if (this.props.room) {
            this.props.room.on("Room.name", this._onRoomNameChange);
        }
    }

    componentDidUpdate() {
        if (this._topic.current) {
            linkifyElement(this._topic.current);
        }
    }

    componentWillUnmount() {
        if (this.props.room) {
            this.props.room.removeListener("Room.name", this._onRoomNameChange);
        }
        const cli = MatrixClientPeg.get();
        if (cli) {
            cli.removeListener("RoomState.events", this._onRoomStateEvents);
            cli.removeListener("Room.accountData", this._onRoomAccountData);
        }
    }

    _onRoomStateEvents = (event, state) => {
        if (!this.props.room || event.getRoomId() !== this.props.room.roomId) {
            return;
        }

        // redisplay the room name, topic, etc.
        this._rateLimitedUpdate();
    };

    _onRoomAccountData = (event, room) => {
        if (!this.props.room || room.roomId !== this.props.room.roomId) return;
        if (event.getType() !== "im.vector.room.read_pins") return;

        this._rateLimitedUpdate();
    };

    _rateLimitedUpdate = new RateLimitedFunc(function() {
        /* eslint-disable babel/no-invalid-this */
        this.forceUpdate();
    }, 500);

    _onRoomNameChange = (room) => {
        this.forceUpdate();
    };

    onShareRoomClick = (ev) => {
        Modal.createTrackedDialog('share room dialog', '', ShareDialog, {
            target: this.props.room,
        });
    };

    onCloseCaseClick = async (ev) => {
        const modal = Modal.createTrackedDialog('Close Case', '', ConfirmCloseCaseDialog);

        const closeCase = await modal.finished;

        if (closeCase) {
          // send case closed event
          const client = MatrixClientPeg.get();

          const doneContent = {};
          doneContent["done"] = true;
          client._sendCompleteEvent(this.props.room.roomId, {
            type: 'care.amp.done',
            state_key: 'care.amp.done',
            content: doneContent,
          });
          Analytics.trackEvent('AMP.care cases', 'case closed');
        }
    };

    onArchiveCaseClick = (ev) => {
        Modal.createTrackedDialog('Archive case', '', ConfirmArchiveCaseDialog, {
            onFinished: (archiveCase) => {
                if (!archiveCase) return;
                dis.dispatch({action: 'view_create_report', room_id: this.props.room.roomId});
            },
            room: this.props.room,
        });
    };

    _hasUnreadPins() {
        const currentPinEvent = this.props.room.currentState.getStateEvents("m.room.pinned_events", '');
        if (!currentPinEvent) return false;
        if (currentPinEvent.getContent().pinned && currentPinEvent.getContent().pinned.length <= 0) {
            return false; // no pins == nothing to read
        }

        const readPinsEvent = this.props.room.getAccountData("im.vector.room.read_pins");
        if (readPinsEvent && readPinsEvent.getContent()) {
            const readStateEvents = readPinsEvent.getContent().event_ids || [];
            if (readStateEvents) {
                return !readStateEvents.includes(currentPinEvent.getId());
            }
        }

        // There's pins, and we haven't read any of them
        return true;
    }

    _hasPins() {
        const currentPinEvent = this.props.room.currentState.getStateEvents("m.room.pinned_events", '');
        if (!currentPinEvent) return false;

        return !(currentPinEvent.getContent().pinned && currentPinEvent.getContent().pinned.length <= 0);
    }

    render() {
        let searchStatus = null;
        let cancelButton = null;

        const isGuest = MatrixClientPeg.get().isGuest();

        if (this.props.onCancelClick) {
            cancelButton = <CancelButton onClick={this.props.onCancelClick} />;
        }

        // don't display the search count until the search completes and
        // gives us a valid (possibly zero) searchCount.
        if (this.props.searchInfo &&
            this.props.searchInfo.searchCount !== undefined &&
            this.props.searchInfo.searchCount !== null) {
            searchStatus = <div className="mx_RoomHeader_searchStatus">&nbsp;
                { _t("(~%(count)s results)", { count: this.props.searchInfo.searchCount }) }
            </div>;
        }

        // XXX: this is a bit inefficient - we could just compare room.name for 'Empty room'...
        let settingsHint = false;
        const members = this.props.room ? this.props.room.getJoinedMembers() : undefined;
        if (members) {
            if (members.length === 1 && members[0].userId === MatrixClientPeg.get().credentials.userId) {
                const nameEvent = this.props.room.currentState.getStateEvents('m.room.name', '');
                if (!nameEvent || !nameEvent.getContent().name) {
                    settingsHint = true;
                }
            }
        }

        let roomName = _t("Join Room");
        if (this.props.oobData && this.props.oobData.name) {
            roomName = this.props.oobData.name;
        } else if (this.props.room) {
            roomName = this.props.room.name;
        }

        const textClasses = classNames('mx_RoomHeader_nametext', { mx_RoomHeader_settingsHint: settingsHint });
        let name;
        if (isGuest) {
            name =
                <div className="mx_RoomHeader_name">
                    <div dir="auto" className={textClasses} title={roomName}>{ roomName }</div>
                    { searchStatus }
                </div>;
        } else {
            name =
                <div className="mx_RoomHeader_name" onClick={this.props.onSettingsClick}>
                    <div dir="auto" className={textClasses} title={roomName}>{ roomName }</div>
                    { searchStatus }
                </div>;
        }

        let topic;
        if (this.props.room) {
            const ev = this.props.room.currentState.getStateEvents('m.room.topic', '');
            if (ev) {
                topic = ev.getContent().topic;
            }
        }
        const topicElement =
            <div className="mx_RoomHeader_topic" ref={this._topic} title={topic} dir="auto">{ topic }</div>;

        let roomAvatar;
        if (this.props.room) {
            roomAvatar = <DecoratedRoomAvatar
                room={this.props.room}
                avatarSize={32}
                tag={DefaultTagID.Untagged} // to apply room publicity badging
                oobData={this.props.oobData}
                viewAvatarOnClick={true} />;
        }

        let shareRoomButton;
        const dmUserId = DMRoomMap.shared().getUserIdForRoomId(this.props.room.roomId);
        if (this.props.inRoom && !this.props.isCaseClosed && !dmUserId && !isGuest) {
            shareRoomButton =
                <AccessibleButton className="amp_RoomHeader_share_button"
                    onClick={this.onShareRoomClick}
                    title={_t('Create invite')}
                >
                    <span>{ _t('Create invite') }</span>
                </AccessibleButton>;
        }

        let closeCaseButton;
        let archiveCaseButton;

        if (!isGuest) {
          closeCaseButton =
              <AccessibleButton className={this.props.isCaseClosed ? "amp_RoomHeader_close_button_inactive" : "amp_RoomHeader_close_button_active"}
                                onClick={this.onCloseCaseClick}
                                title={this.props.isCaseClosed ? _t('Case closed') : _t('Close case')}
                                disabled={this.props.isCaseClosed}
              >
                  <span>{ this.props.isCaseClosed ? _t('Case closed') : _t('Close case') }</span>
              </AccessibleButton>;

          archiveCaseButton =
              <AccessibleButton className={this.props.isCaseClosed ? "amp_RoomHeader_archive_button_active" : "amp_RoomHeader_archive_button_inactive"}
                                onClick={this.onArchiveCaseClick}
                                title={_t('Archive case')}
                                disabled={!this.props.isCaseClosed}
              >
                  <span>{ _t('Archive case') }</span>
              </AccessibleButton>;
        }

        const rightRow =
            <div className="mx_RoomHeader_buttons">
                { shareRoomButton }
                { closeCaseButton }
                { archiveCaseButton }
            </div>;

        let roomHeaderButton = null;
        if (!isGuest) {
            roomHeaderButton = <RoomHeaderButtons />;
        }

        return (
            <div className="mx_RoomHeader light-panel">
                <div className="mx_RoomHeader_wrapper" aria-owns="mx_RightPanel">
                    <div className="mx_RoomHeader_avatar">{ roomAvatar }</div>
                    { name }
                    { topicElement }
                    { cancelButton }
                    { rightRow }
                    { roomHeaderButton }
                </div>
            </div>
        );
    }
}
