const { assert } = require('chai');
const sinon = require('sinon');
const AxeInjector = require('../../lib/axe-injector');

class MockWebDriver {
  constructor(methods) {
    if (methods) {
      for (const name of Object.keys(methods)) {
        this[name] = methods[name];
      }
    }
  }

  switchTo() {
    return {
      frame: () => Promise.resolve(),
      defaultContent: () => Promise.resolve()
    };
  }

  executeScript() {
    return Promise.resolve();
  }

  findElements() {
    return Promise.resolve([]);
  }
}

describe('AxeInjector', () => {
  it('accepts custom axe-core source', () => {
    const axeSource = 'alert("Hello world!")';
    const injector = new AxeInjector({
      driver: new MockWebDriver(),
      axeSource
    });
    assert.equal(injector.axeSource, axeSource);
  });

  it('accepts custom axe config', () => {
    const injector = new AxeInjector({
      driver: new MockWebDriver(),
      config: { foo: 'bar' }
    });
    assert.equal(injector.config, '{"foo":"bar"}');
  });

  describe('errorHandler', () => {
    it('only logs once', () => {
      const injector = new AxeInjector({ driver: new MockWebDriver() });
      const spy = sinon.spy(console, 'log');

      injector.errorHandler();
      injector.errorHandler();

      assert.equal(spy.callCount, 1);

      spy.restore();
    });
  });

  describe('script', () => {
    it('includes axe', () => {
      const injector = new AxeInjector({
        driver: new MockWebDriver(),
        axeSource: 'axesource!'
      });
      const script = injector.script;
      assert(script.includes('axesource!'));
    });

    it('includes config', () => {
      const injector = new AxeInjector({
        driver: new MockWebDriver(),
        config: { foo: 'bar' }
      });
      const script = injector.script;
      assert(script.includes('axe.configure({"foo":"bar"})'));
    });

    it('includes branding', () => {
      const injector = new AxeInjector({
        driver: new MockWebDriver()
      });
      const script = injector.script;
      assert(script.includes('webdriverjs'));
    });
  });

  describe('handleFrame', () => {
    it('switches to the frame', async () => {
      let switched = false;

      const injector = new AxeInjector({
        driver: new MockWebDriver({
          switchTo() {
            return {
              frame(frame) {
                assert.equal(frame, 1);
                switched = true;
              }
            };
          }
        })
      });
      await injector.handleFrame(1);
      assert(switched);
    });

    it('injects into the frame', async () => {
      const driver = new MockWebDriver();
      const executeScript = sinon.spy(driver, 'executeScript');
      const injector = new AxeInjector({ driver });
      await injector.handleFrame(1);
      assert(executeScript.calledOnce);
    });

    it('injects into all child frames', async () => {
      let didReturnIframes = false;
      const driver = new MockWebDriver({
        findElements(selector) {
          assert.equal(selector.tagName, 'iframe');
          if (didReturnIframes) {
            return;
          }
          didReturnIframes = true;
          return [1, 2, 3, 4];
        }
      });

      const injector = new AxeInjector({ driver });
      const executeScript = sinon.spy(driver, 'executeScript');
      await injector.handleFrame(1);
      // once for the top-frame and 4 more for the other frames
      assert.equal(executeScript.callCount, 5);
    });
  });

  describe('injectIntoAllFrames', () => {
    it('switches to the top frame', async () => {
      let calls = 0;
      const driver = new MockWebDriver({
        switchTo() {
          return {
            defaultContent() {
              calls++;
            }
          };
        }
      });
      const injector = new AxeInjector({ driver });
      await injector.injectIntoAllFrames();
      assert.equal(calls, 2);
    });

    it('injects axe into the top frame', async () => {
      const driver = new MockWebDriver();
      const executeScript = sinon.spy(driver, 'executeScript');
      const injector = new AxeInjector({ driver });
      await injector.injectIntoAllFrames();
      assert(executeScript.calledOnce);
    });

    it('injects axe into all child frames', async () => {
      let didReturnIframes = false;
      const driver = new MockWebDriver({
        findElements(selector) {
          assert.equal(selector.tagName, 'iframe');
          if (didReturnIframes) {
            return;
          }
          didReturnIframes = true;
          return [1, 2, 3, 4];
        }
      });

      const injector = new AxeInjector({ driver });
      const executeScript = sinon.spy(driver, 'executeScript');
      await injector.injectIntoAllFrames();
      // once for the top-frame and 4 more for the other frames
      assert.equal(executeScript.callCount, 5);
    });
  });

  describe('inject', () => {
    it('injects into all frames', done => {
      const injector = new AxeInjector({ driver: new MockWebDriver() });
      const spy = sinon.spy(injector, 'injectIntoAllFrames');
      injector.inject(() => {
        assert(spy.calledOnce);
        done();
      });
    });

    it('ignores errors', done => {
      const injector = new AxeInjector({ driver: new MockWebDriver() });
      const stub = sinon.stub(injector, 'injectIntoAllFrames');

      stub.rejects(new Error('oh no!'));

      injector.inject(done);
    });
  });
});
