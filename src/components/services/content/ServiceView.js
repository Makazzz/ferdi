import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { autorun, reaction } from 'mobx';
import { observer, inject } from 'mobx-react';
import classnames from 'classnames';

import ServiceModel from '../../../models/Service';
import StatusBarTargetUrl from '../../ui/StatusBarTargetUrl';
import WebviewLoader from '../../ui/WebviewLoader';
import WebviewCrashHandler from './WebviewCrashHandler';
import WebviewErrorHandler from './ErrorHandlers/WebviewErrorHandler';
import ServiceDisabled from './ServiceDisabled';
import ServiceWebview from './ServiceWebview';
import SettingsStore from '../../../stores/SettingsStore';
import WebControlsScreen from '../../../features/webControls/containers/WebControlsScreen';

export default @observer @inject('stores') class ServiceView extends Component {
  static propTypes = {
    service: PropTypes.instanceOf(ServiceModel).isRequired,
    setWebviewReference: PropTypes.func.isRequired,
    detachService: PropTypes.func.isRequired,
    reload: PropTypes.func.isRequired,
    edit: PropTypes.func.isRequired,
    enable: PropTypes.func.isRequired,
    isActive: PropTypes.bool,
    stores: PropTypes.shape({
      settings: PropTypes.instanceOf(SettingsStore).isRequired,
    }).isRequired,
  };

  static defaultProps = {
    isActive: false,
  };

  state = {
    forceRepaint: false,
    targetUrl: '',
    statusBarVisible: false,
    hibernate: false,
    hibernationTimer: null,
  };

  autorunDisposer = null;

  forceRepaintTimeout = null;

  constructor(props) {
    super(props);

    this.startHibernationTimer = this.startHibernationTimer.bind(this);
  }

  componentDidMount() {
    this.autorunDisposer = autorun(() => {
      if (this.props.service.isActive) {
        this.setState({ forceRepaint: true });
        this.forceRepaintTimeout = setTimeout(() => {
          this.setState({ forceRepaint: false });
        }, 100);
      }
    });

    reaction(
      () => this.props.service.isActive,
      () => {
        if (!this.props.service.isActive && this.props.stores.settings.all.app.hibernate) {
          // Service is inactive - start hibernation countdown
          this.startHibernationTimer();
        } else {
          if (this.state.hibernationTimer) {
            // Service is active but we have an active hibernation timer: Clear timeout
            clearTimeout(this.state.hibernationTimer);
          }

          // Service is active, wake up service from hibernation
          this.setState({
            hibernate: false,
          });
        }
      },
    );

    // Start hibernation counter if we are in background
    if (!this.props.service.isActive && this.props.stores.settings.all.app.hibernate) {
      this.startHibernationTimer();
    }
  }

  componentWillUnmount() {
    this.autorunDisposer();
    clearTimeout(this.forceRepaintTimeout);
  }

  updateTargetUrl = (event) => {
    let visible = true;
    if (event.url === '' || event.url === '#') {
      visible = false;
    }
    this.setState({
      targetUrl: event.url,
      statusBarVisible: visible,
    });
  };

  startHibernationTimer() {
    const timerDuration = (Number(this.props.stores.settings.all.app.hibernationStrategy) || 300) * 1000;

    const hibernationTimer = setTimeout(() => {
      this.setState({
        hibernate: true,
      });
    }, timerDuration);

    this.setState({
      hibernationTimer,
    });
  }

  render() {
    const {
      detachService,
      service,
      setWebviewReference,
      reload,
      edit,
      enable,
    } = this.props;

    const webviewClasses = classnames({
      services__webview: true,
      'services__webview-wrapper': true,
      'is-active': service.isActive,
      'services__webview--force-repaint': this.state.forceRepaint,
    });

    let statusBar = null;
    if (this.state.statusBarVisible) {
      statusBar = (
        <StatusBarTargetUrl text={this.state.targetUrl} />
      );
    }

    return (
      <div className={webviewClasses}>
        {service.isActive && service.isEnabled && (
          <Fragment>
            {service.hasCrashed && (
              <WebviewCrashHandler
                name={service.recipe.name}
                webview={service.webview}
                reload={reload}
              />
            )}
            {service.isEnabled && service.isLoading && service.isFirstLoad && !service.isServiceAccessRestricted && (
              <WebviewLoader
                loaded={false}
                name={service.name}
              />
            )}
            {service.isError && (
              <WebviewErrorHandler
                name={service.recipe.name}
                errorMessage={service.errorMessage}
                reload={reload}
                edit={edit}
              />
            )}
          </Fragment>
        )}
        {!service.isEnabled ? (
          <Fragment>
            {service.isActive && (
              <ServiceDisabled
                name={service.recipe.name}
                webview={service.webview}
                enable={enable}
              />
            )}
          </Fragment>
        ) : (
          <>
            {service.recipe.id === 'franz-custom-website' && (
              <WebControlsScreen service={service} />
            )}
            {!this.state.hibernate ? (
              <ServiceWebview
                service={service}
                setWebviewReference={setWebviewReference}
                detachService={detachService}
              />
            ) : (
              <div>
                <span role="img" aria-label="Sleeping Emoji">😴</span>
                {' '}
                This service is currently hibernating. If this page doesn&#x27;t close soon, please try reloading Ferdi.
              </div>
            )}
          </>
        )}
        {statusBar}
      </div>
    );
  }
}
