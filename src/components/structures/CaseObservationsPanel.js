/*
Copyright 2016 OpenMarket Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 Awesome Technologies Innovationslabor GmbH

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

import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import createReactClass from 'create-react-class';
import classNames from 'classnames';
import shouldHideEvent from '../../shouldHideEvent';
import {wantsDateSeparator} from '../../DateUtils';
import sdk from '../../index';
import {_t} from "../../languageHandler";

import MatrixClientPeg from '../../MatrixClientPeg';
import SettingsStore from '../../settings/SettingsStore';

const CONTINUATION_MAX_INTERVAL = 5 * 60 * 1000; // 5 minutes
const continuedTypes = ['m.sticker', 'm.room.message'];

/* (almost) stateless UI component which builds the event tiles in the room timeline.
 */

module.exports = createReactClass({
    displayName: 'CaseObservationsPanel',

    propTypes: {
        // true to give the component a 'display: none' style.
        hidden: PropTypes.bool,

        // true to show a spinner at the top of the timeline to indicate
        // back-pagination in progress
        backPaginating: PropTypes.bool,

        // true to show a spinner at the end of the timeline to indicate
        // forward-pagination in progress
        forwardPaginating: PropTypes.bool,

        // the list of MatrixEvents to display
        events: PropTypes.array.isRequired,

        // ID of an event to highlight. If undefined, no event will be highlighted.
        highlightedEventId: PropTypes.string,

        // Should we show URL Previews
        showUrlPreview: PropTypes.bool,

        // event after which we should show a read marker
        readMarkerEventId: PropTypes.string,

        // whether the read marker should be visible
        readMarkerVisible: PropTypes.bool,

        // the userid of our user. This is used to suppress the read marker
        // for pending messages.
        ourUserId: PropTypes.string,

        // true to suppress the date at the start of the timeline
        suppressFirstDateSeparator: PropTypes.bool,

        // whether to show read receipts
        showReadReceipts: PropTypes.bool,

        // true if updates to the event list should cause the scroll panel to
        // scroll down when we are at the bottom of the window. See ScrollPanel
        // for more details.
        stickyBottom: PropTypes.bool,
        startAtBottom: PropTypes.bool,

        // callback which is called when the panel is scrolled.
        onScroll: PropTypes.func,

        // callback which is called when more content is needed.
        onFillRequest: PropTypes.func,

        // className for the panel
        className: PropTypes.string.isRequired,

        // shape parameter to be passed to EventTiles
        tileShape: PropTypes.string,

        // show twelve hour timestamps
        isTwelveHour: PropTypes.bool,

        // show timestamps always
        alwaysShowTimestamps: PropTypes.bool,

        // helper function to access relations for an event
        getRelationsForEvent: PropTypes.func,

        // whether to show reactions for an event
        showReactions: PropTypes.bool,
    },

    componentWillMount: function() {
        // the event after which we put a visible unread marker on the last
        // render cycle; null if readMarkerVisible was false or the RM was
        // suppressed (eg because it was at the end of the timeline)
        this.currentReadMarkerEventId = null;

        // the event after which we are showing a disappearing read marker
        // animation
        this.currentGhostEventId = null;

        // opaque readreceipt info for each userId; used by ReadReceiptMarker
        // to manage its animations
        this._readReceiptMap = {};

        // Remember the read marker ghost node so we can do the cleanup that
        // Velocity requires
        this._readMarkerGhostNode = null;

        this._isMounted = true;

        this.setState({
            caseTitle: '-',
            caseNote: '-',
            caseSeverity: '-',
            caseRequester: '-',
            patientName: '-',
            patientGender: '-',
            patientBirthdate: '-',

            vitalData_bloodPressureSys: '-',
            vitalData_bloodPressureDia: '-',
            vitalData_bloodpressureDatetime: '',
            vitalData_pulse: '-',
            vitalData_pulseDatetime: '',
            vitalData_temperature: '-',
            vitalData_temperatureDatetime: '',
            vitalData_bloodSugar: '-',
            vitalData_bloodSugarDatetime: '',
            vitalData_weight: '-',
            vitalData_weightDatetime: '',
            vitalData_oxygen: '-',
            vitalData_oxygenDatetime: '',
            anamnesisData_responsiveness: '',
            anamnesisData_pain: '',
            anamnesisData_lastDefecation: '',
            anamnesisData_misc: '',
            medicationData_activeAgent: '',
            medicationData_brand: '',
            medicationData_strength: '',
            medicationData_form: '',
            medicationData_mo: '',
            medicationData_no: '',
            medicationData_ev: '',
            medicationData_ni: '',
            medicationData_unit: '',
            medicationData_notes: '',
            medicationData_reason: '',
            hasCaseData: false,
            hasPatientData: false,
            hasVitalData: false,
            hasAnamnesisData: false,
            hasMedicationData: false,
        });
    },

    componentWillUnmount: function() {
        this._isMounted = false;
    },

    /* get the DOM node representing the given event */
    getNodeForEventId: function(eventId) {
        if (!this.eventNodes) {
            return undefined;
        }

        return this.eventNodes[eventId];
    },

    // returns one of:
    //
    //  null: there is no read marker
    //  -1: read marker is above the window
    //   0: read marker is within the window
    //  +1: read marker is below the window
    getReadMarkerPosition: function() {
        const readMarker = this.refs.readMarkerNode;
        const messageWrapper = this.refs.scrollPanel;

        if (!readMarker || !messageWrapper) {
            return null;
        }

        const wrapperRect = ReactDOM.findDOMNode(messageWrapper).getBoundingClientRect();
        const readMarkerRect = readMarker.getBoundingClientRect();

        // the read-marker pretends to have zero height when it is actually
        // two pixels high; +2 here to account for that.
        if (readMarkerRect.bottom + 2 < wrapperRect.top) {
            return -1;
        } else if (readMarkerRect.top < wrapperRect.bottom) {
            return 0;
        } else {
            return 1;
        }
    },

    _isUnmounting: function() {
        return !this._isMounted;
    },

    // TODO: Implement granular (per-room) hide options
    _shouldShowEvent: function(mxEv) {
        // filter for type='care.amp.observation' or state_key='care.amp.patient/care.amp.case'
        if( mxEv.event.state_key === "care.amp.case" || mxEv.event.state_key === "care.amp.patient"){
          return true;
        }

        if(mxEv._clearEvent.type !== undefined){
          if(mxEv._clearEvent.type === "care.amp.observation"){
            return true;
          }
          if(mxEv._clearEvent.type === "care.amp.done"){
            return true;
          }
        }

        // unencrypted events
        if(mxEv.event.type === "care.amp.observation"){
          return true;
        }
        if(mxEv.event.type === "care.amp.done"){
          return true;
        }

        // ignore everything else
        return false;
    },

    _getEventTiles: function() {
        const DateSeparator = sdk.getComponent('messages.DateSeparator');
        const MemberEventListSummary = sdk.getComponent('views.elements.MemberEventListSummary');

        this.eventNodes = {};

        let visible = false;
        let i;

        // first figure out which is the last event in the list which we're
        // actually going to show; this allows us to behave slightly
        // differently for the last event in the list. (eg show timestamp)
        //
        // we also need to figure out which is the last event we show which isn't
        // a local echo, to manage the read-marker.
        let lastShownEvent;

        let lastShownNonLocalEchoIndex = -1;
        for (i = this.props.events.length-1; i >= 0; i--) {
            const mxEv = this.props.events[i];
            if (!this._shouldShowEvent(mxEv)) {
                continue;
            }

            if (lastShownEvent === undefined) {
                lastShownEvent = mxEv;
            }

            if (mxEv.status) {
                // this is a local echo
                continue;
            }

            lastShownNonLocalEchoIndex = i;
            break;
        }

        const ret = [];

        let prevEvent = null; // the last event we showed

        // assume there is no read marker until proven otherwise
        let readMarkerVisible = false;

        // if the readmarker has moved, cancel any active ghost.
        if (this.currentReadMarkerEventId && this.props.readMarkerEventId &&
                this.props.readMarkerVisible &&
                this.currentReadMarkerEventId !== this.props.readMarkerEventId) {
            this.currentGhostEventId = null;
        }

        const isMembershipChange = (e) => e.getType() === 'm.room.member';

        for (i = 0; i < this.props.events.length; i++) {
            const mxEv = this.props.events[i];
            const eventId = mxEv.getId();
            const last = (mxEv === lastShownEvent);

            const wantTile = this._shouldShowEvent(mxEv);

            if (wantTile) {
                this._parseData(mxEv);
                prevEvent = mxEv;
            }

            let isVisibleReadMarker = false;

            if (eventId === this.props.readMarkerEventId) {
                visible = this.props.readMarkerVisible;

                // if the read marker comes at the end of the timeline (except
                // for local echoes, which are excluded from RMs, because they
                // don't have useful event ids), we don't want to show it, but
                // we still want to create the <li/> for it so that the
                // algorithms which depend on its position on the screen aren't
                // confused.
                if (i >= lastShownNonLocalEchoIndex) {
                    visible = false;
                }
                ret.push(this._getReadMarkerTile(visible));
                readMarkerVisible = visible;
                isVisibleReadMarker = visible;
            }

            // XXX: there should be no need for a ghost tile - we should just use a
            // a dispatch (user_activity_end) to start the RM animation.
            if (eventId === this.currentGhostEventId) {
                // if we're showing an animation, continue to show it.
                ret.push(this._getReadMarkerGhostTile());
            } else if (!isVisibleReadMarker &&
                       eventId === this.currentReadMarkerEventId) {
                // there is currently a read-up-to marker at this point, but no
                // more. Show an animation of it disappearing.
                ret.push(this._getReadMarkerGhostTile());
                this.currentGhostEventId = eventId;
            }
        }

        this.currentReadMarkerEventId = readMarkerVisible ? this.props.readMarkerEventId : null;
        return ret;
    },

    // get a list of read receipts that should be shown next to this event
    // Receipts are objects which have a 'userId', 'roomMember' and 'ts'.
    _getReadReceiptsForEvent: function(event) {
        const myUserId = MatrixClientPeg.get().credentials.userId;

        // get list of read receipts, sorted most recent first
        const room = MatrixClientPeg.get().getRoom(event.getRoomId());
        if (!room) {
            return null;
        }
        const receipts = [];
        room.getReceiptsForEvent(event).forEach((r) => {
            if (!r.userId || r.type !== "m.read" || r.userId === myUserId) {
                return; // ignore non-read receipts and receipts from self.
            }
            if (MatrixClientPeg.get().isUserIgnored(r.userId)) {
                return; // ignore ignored users
            }
            const member = room.getMember(r.userId);
            receipts.push({
                userId: r.userId,
                roomMember: member,
                ts: r.data ? r.data.ts : 0,
            });
        });

        return receipts.sort((r1, r2) => {
            return r2.ts - r1.ts;
        });
    },

    _getReadMarkerTile: function(visible) {
        let hr;
        if (visible) {
            hr = <hr className="mx_RoomView_myReadMarker"
                    style={{opacity: 1, width: '99%'}}
                />;
        }

        return (
            <li key="_readupto" ref="readMarkerNode"
                  className="mx_RoomView_myReadMarker_container">
                { hr }
            </li>
        );
    },

    _startAnimation: function(ghostNode) {
        if (this._readMarkerGhostNode) {
            Velocity.Utilities.removeData(this._readMarkerGhostNode);
        }
        this._readMarkerGhostNode = ghostNode;

        if (ghostNode) {
            Velocity(ghostNode, {opacity: '0', width: '10%'},
                     {duration: 400, easing: 'easeInSine',
                      delay: 1000});
        }
    },

    _getReadMarkerGhostTile: function() {
        const hr = <hr className="mx_RoomView_myReadMarker"
                  style={{opacity: 1, width: '99%'}}
                  ref={this._startAnimation}
            />;

        // give it a key which depends on the event id. That will ensure that
        // we get a new DOM node (restarting the animation) when the ghost
        // moves to a different event.
        return (
            <li key={"_readuptoghost_"+this.currentGhostEventId}
                  className="mx_RoomView_myReadMarker_container">
                { hr }
            </li>
        );
    },

    _collectEventNode: function(eventId, node) {
        this.eventNodes[eventId] = node;
    },

    _parseData: function(mxEv) {

      // return if event is not decrypted yet
      if(mxEv.event.type === 'm.room.encrypted' && mxEv._clearEvent.type === undefined){
        return;
      }

      if(mxEv.event.type === 'm.room.encrypted'){
        console.log("AMP.care encrypted Event " + mxEv._clearEvent.type);
      }
      else{
        console.log("AMP.care Event " + mxEv.event.type);
      }
      console.log(mxEv);
      /*
      let content = mxEv._clearEvent.content;
      if(content === undefined){
        // search for unencrypted content
        content = mxEv.event.content;
        if(content === undefined){
          return;
        }
      }*/


      let local_event = mxEv.event;
      if(mxEv.event.type === 'm.room.encrypted') {
        local_event = mxEv._clearEvent;
      }

      if( local_event.type === "care.amp.case" ){
        if(local_event.content.title !== undefined) {
          this.state.caseTitle = local_event.content.title;
          this.state.hasCaseData = true;
        }
        if(local_event.content.note !== undefined) {
          this.state.caseNote = local_event.content.note;
          this.state.hasCaseData = true;
        }
        if(local_event.content.severity !== undefined) {
          this.state.caseSeverity = local_event.content.severity;
          this.state.hasCaseData = true;
        }
        if(local_event.content.requester !== undefined) {
          this.state.caseRequester = local_event.content.requester.reference;
          this.state.hasCaseData = true;
        }
      }

      if( local_event.type === "care.amp.patient" ){
        if(local_event.content.name !== '' && local_event.content.name !== undefined){
            this.state.patientName = local_event.content.name;
            this.state.hasPatientData = true;
        }
        if(local_event.content.gender !== undefined) {
          this.state.patientGender = local_event.content.gender;
          if(local_event.content.gender !== 'unknown'){
            this.state.hasPatientData = true;
          }
        }
        if(local_event.content.birthDate !== '' && local_event.content.birthDate !== undefined) {
          var date = new Date(local_event.content.birthDate);
          this.state.patientBirthdate = date.toLocaleDateString();
          this.state.hasPatientData = true;
        }
      }

      if( local_event.type === "care.amp.observation" ){
        switch(local_event.content.id){
          case('heart-rate'):
            this.state.vitalData_pulse = local_event.content.valueQuantity.value;
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.vitalData_pulseDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            else{
              this.state.vitalData_pulseDatetime = '-';
            }
            this.state.hasVitalData = true;
            break;
          case('glucose'):
            this.state.vitalData_bloodSugar = local_event.content.valueQuantity.value;
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.vitalData_bloodSugarDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            else{
              this.state.vitalData_bloodSugarDatetime = '-';
            }
            this.state.hasVitalData = true;
            break;
          case('body-temperature'):
            this.state.vitalData_temperature = local_event.content.valueQuantity.value;
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.vitalData_temperatureDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            else{
              this.state.vitalData_temperatureDatetime = '-';
            }
            this.state.hasVitalData = true;
            break;
          case('blood-pressure'):
            this.state.vitalData_bloodPressureSys = local_event.content.component[0].valueQuantity.value;
            this.state.vitalData_bloodPressureDia = local_event.content.component[1].valueQuantity.value;
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.vitalData_bloodpressureDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            else{
              this.state.vitalData_bloodpressureDatetime = '-';
            }
            this.state.hasVitalData = true;
            break;
          case('body-weight'):
            this.state.vitalData_weight = local_event.content.valueQuantity.value;
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.vitalData_weightDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            else{
              this.state.vitalData_weightDatetime = '-';
            }
            this.state.hasVitalData = true;
            break;
          case('oxygen'):
            this.state.vitalData_oxygen = local_event.content.valueQuantity.value;
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.vitalData_oxygenDatetime = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
            }
            else{
              this.state.vitalData_oxygenDatetime = '-';
            }
            this.state.hasVitalData = true;
            break;
          case('last-defecation'):
            if(local_event.content.effectiveDateTime !== '' && local_event.content.effectiveDateTime !== undefined){
              var date = new Date(local_event.content.effectiveDateTime);
              this.state.anamnesisData_lastDefecation = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              this.state.hasAnamnesisData = true;
            }
            break;
          case('misc'):
            this.state.anamnesisData_misc = local_event.content.valueString;
            this.state.hasAnamnesisData = true;
            break;
          case('responsiveness'):
            this.state.anamnesisData_responsiveness = local_event.content.valueString;
            this.state.hasAnamnesisData = true;
            break;
          case('pain'):
            this.state.anamnesisData_pain = local_event.content.valueString;
            this.state.hasAnamnesisData = true;
            break;
        }
      }
    },

    render: function() {

        const caseDetailsStyle = this.state.hasCaseData ? {} : { display: 'none' };
        const patientStyle = this.state.hasPatientData ? {} : { display: 'none' };
        const vitalDataStyle = this.state.hasVitalData ? {} : { display: 'none' };
        const anamnesisDataStyle = this.state.hasAnamnesisData ? {} : { display: 'none' };
        const medicationDataStyle = this.state.hasMedicationData ? {} : { display: 'none' };
        const hideall = this.state.hasCaseData || this.state.hasPatientData || this.state.hasVitalData || this.state.hasAnamnesisData || this.state.hasMedicationData;
        const caseStyle = hideall ? {} : { display: 'none' };

        let severityClass = "amp_CaseObservationsPanel_Severity_info";
        switch(this.state.caseSeverity){
          case('critical'):
            severityClass = "amp_CaseObservationsPanel_Severity_critical";
            break;
          case('urgent'):
            severityClass = "amp_CaseObservationsPanel_Severity_urgent";
            break;
          case('request'):
            severityClass = "amp_CaseObservationsPanel_Severity_request";
            break;
        }
        this._getEventTiles();

        const ScrollPanel = sdk.getComponent("structures.ScrollPanel");
        const Spinner = sdk.getComponent("elements.Spinner");
        let topSpinner;
        let bottomSpinner;
        if (this.props.backPaginating) {
            topSpinner = <li key="_topSpinner"><Spinner /></li>;
        }
        if (this.props.forwardPaginating) {
            bottomSpinner = <li key="_bottomSpinner"><Spinner /></li>;
        }

        let caseData;
        caseData = <div>
            <div className="amp_CaseObservationsPanel_Patient" style={patientStyle}>
              <table className="amp_CaseObservationsPanel_Table_patientData">
                <tbody>
                  <tr>
                    <td><span className="amp_CaseObservationsPanel_patientData_header">{_t("Patient name")}</span></td>
                    <td><span className="amp_CaseObservationsPanel_patientData_header">{_t("Gender")}</span></td>
                    <td><span className="amp_CaseObservationsPanel_patientData_header">{_t("Birthday")}</span></td>
                  </tr>
                  <tr>
                    <td><span className="amp_CaseObservationsPanel_patientData">{this.state.patientName}</span></td>
                    <td><span className="amp_CaseObservationsPanel_patientData">{_t(this.state.patientGender)}</span></td>
                    <td><span className="amp_CaseObservationsPanel_patientData">{this.state.patientBirthdate}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="amp_CaseObservationsPanel_CaseDetails" style={caseDetailsStyle}>
              <table className="amp_CaseObservationsPanel_Table">
                <tbody>
                  <tr>
                    <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Title")}</span></td>
                    <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Severity")}</span></td>
                    <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Requester")}</span></td>
                  </tr>
                  <tr>
                    <td width="70%"><span className="amp_CaseObservationsPanel_caseData">{this.state.caseTitle}</span></td>
                    <td width="10%"><span className="amp_CaseObservationsPanel_caseData">{_t(this.state.caseSeverity)}</span></td>
                    <td width="20%"><span className="amp_CaseObservationsPanel_caseData">{this.state.caseRequester}</span></td>
                  </tr>
                </tbody>
              </table>
              <table className="amp_CaseObservationsPanel_Table">
                <tbody>
                  <tr>
                    <td><span className="amp_CaseObservationsPanel_caseData_header">{_t("Message")}</span></td>
                  </tr>
                  <tr>
                    <td><span className="amp_CaseObservationsPanel_caseData">{this.state.caseNote}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="amp_CaseObservationsPanel_Observations">
              <div style={vitalDataStyle}>
                <span className="amp_CaseObservationsPanel_subheading">{_t("Vital data")}</span>
                <table className="amp_CaseObservationsPanel_Table">
                    <thead>
                        <tr>
                            <th width="25%"></th>
                            <th width="25%"></th>
                            <th width="25%"></th>
                            <th width="25%"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                          <td>{_t("Weight")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_weight} kg</td>
                          <td>{_t("Temperature")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_temperature} °C</td>
                        </tr>
                        <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                          <td>{_t("measured")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_weightDatetime}</td>
                          <td>{_t("measured")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_temperatureDatetime}</td>
                        </tr>
                        <tr className="amp_CaseObservationsPanel_TableRow_Even">
                          <td>{_t("Blood pressure")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_bloodPressureSys} mmHg / {this.state.vitalData_bloodPressureDia} mmHg</td>
                          <td>{_t("Blood sugar")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_bloodSugar} mg/dl</td>
                        </tr>
                        <tr className="amp_CaseObservationsPanel_TableRow_Even">
                          <td>{_t("measured")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_bloodpressureDatetime}</td>
                          <td>{_t("measured")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_bloodSugarDatetime}</td>
                        </tr>
                        <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                          <td>{_t("Pulse")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_pulse} bpm</td>
                          <td>{_t("Oxygen saturation")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_oxygen} %</td>
                        </tr>
                        <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                          <td>{_t("measured")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_pulseDatetime}</td>
                          <td>{_t("measured")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.vitalData_oxygenDatetime}</td>
                        </tr>
                    </tbody>
                </table>
              </div>
              <div style={anamnesisDataStyle}>
                <span className="amp_CaseObservationsPanel_subheading">{_t("Anamnesis")}</span>
                <table className="amp_CaseObservationsPanel_Table">
                    <thead>
                        <tr>
                            <th width="25%"></th>
                            <th width="25%"></th>
                            <th width="25%"></th>
                            <th width="25%"></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="amp_CaseObservationsPanel_TableRow_Uneven">
                          <td>{_t("Responsiveness")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.anamnesisData_responsiveness}</td>
                          <td>{_t("Pain")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.anamnesisData_pain}</td>
                        </tr>
                        <tr className="amp_CaseObservationsPanel_TableRow_Even">
                          <td>{_t("Last defecation")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.anamnesisData_lastDefecation}</td>
                          <td>{_t("Misc")}</td>
                          <td className="amp_CaseObservationsPanel_TableCell_Value">{this.state.anamnesisData_misc}</td>
                        </tr>
                    </tbody>
                </table>
              </div>
            </div>
          </div>
          ;

        return (
          <ScrollPanel ref="scrollPanel" className={severityClass}
                  onScroll={this.props.onScroll}
                  onResize={this.onResize}
                  onFillRequest={this.props.onFillRequest}
                  onUnfillRequest={this.props.onUnfillRequest}
                  style={caseStyle}
                  stickyBottom={this.props.stickyBottom}
                  startAtBottom={this.props.startAtBottom}
                  resizeNotifier={this.props.resizeNotifier}>
              { topSpinner }
              { caseData }
              { bottomSpinner }
          </ScrollPanel>

        );
    },
});
