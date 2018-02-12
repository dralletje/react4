require('./index.css');

// let { flatten } = require('lodash');

/*
TODO
- state?
  Do I use the react style this.state and this.setState,
  or do I use a more abstract and "native" (to this system) state provider something?
  1. First this.state and this.setState
  2. Then develop some more generic/native solution

- Simulate css/use canvas
  Write a simple implementation of Dom.div and Dom.text (maybe Generic.Box and Generic.Text ?)
  These would pass through background color and stuff like that using context
  Also has separate Generic.Text that just sets the style, and Generic.Text that actually shows text (with inherited style)

- Events and EventComponent - s
  Put the discord implementation next to this one and see how to handle it
*/


let renderresult_to_array = (render_result) => {
  return (
    Array.isArray(render_result)
    ? render_result
    : [render_result]
  ).filter(Boolean);
}

let React = {
  render: (element, all_context = {}) => {
    let { tree: treeType } = element.type;

    let parent_context = treeType ? all_context[treeType] : null;

    // Construct the instance with the tree we got from the parent
    let instance = new element.type();

    // Get the children from render (as array)
    instance.props = element.props;
    instance.tree = {
      parent: parent_context,
      get children() {
        throw new Error(`Can't get tree children while render-ing`);
      },
    };
    let render_children = renderresult_to_array(instance.render());

    // Get a possible value to provide to children of tree type (overwriting previous value if provided)
    let context_provide = instance.provide ? instance.provide() : parent_context;
    // Merge with previous tree (keeping all other tree types on the old value)
    let context_for_children = {
      ...all_context,
      [treeType]: context_provide,
    }

    // Render all children and keep their instances
    let children_instances = render_children.map(child => {
      return React.render(child, context_for_children);
    });

    // Set all kinds of things we might need in Mount()
    instance._parent_tree = all_context; // This does NOT include own provide()
    instance._treeType = treeType;
    instance._last_render_elements = render_children;
    instance._last_render_instances = children_instances;

    return instance;
  },
  mount: (instance) => {
    let instance_name = instance.name;
    console.group(`Mount ${instance_name}`)
    console.log(`instance to mount:`, instance);

    let { _last_render_elements, _last_render_instances, _treeType, _parent_tree } = instance;
    let treeName = _treeType ? _treeType.toString() : 'NO TREE';

    // Mount all children - first thing you do
    let _last_mount_results = _last_render_instances.map(x => {
      return React.mount(x);
    });

    // Merge all the tree values the children have:
    // Multiple children might each provide
    let child_tree = {};
    for (let mount_result of _last_mount_results) {
      let properties = Object.getOwnPropertySymbols(mount_result);
      for (let tree_prop of properties) {
        child_tree[tree_prop] = child_tree[tree_prop] || [];
        child_tree[tree_prop] = [
          ...child_tree[tree_prop],
          ...mount_result[tree_prop],
        ];
      }
    }

    console.log(`child_tree:`, child_tree)

    // Actually perform the mount on the current instance
    // with the tree constructed from the parent as well as the child instances
    if (instance.mount) {
      // Set up the instance.tree depending on treeType and all
      if (instance._treeType) {
        instance.tree = {
          parent: instance._parent_tree[instance._treeType],
          children: child_tree[instance._treeType],
        }
      } else {
        instance.tree = {
          get parent() {
            throw new Error(`Trying to access tree.parent without a treeType set on component`);
          },
          get child() {
            throw new Error(`Trying to access tree.child without a treeType set on component`);
          }
        };
      }

      // Run the mount function: this will **DO STUFF** (NOT PURE)
      // and set instance.exports to whatever should accessible to parent
      instance.mount();
    }

    console.log(`EXPORTS ${treeName}:`, instance.exports);
    console.groupEnd(`Mount ${instance_name}`);

    // Return child tree with additionally the export of the current instance attached
    // NOTE If the instance exports `null` it will NOT use the parent, but actually use `null`
    if (instance._treeType) {
      return {
        ...child_tree,
        [instance._treeType]: [instance.exports],
      };
    } else {
      return child_tree;
    }
  },

  createElement: (type, props, ...children) => {
    // NOTE This just wraps function in components - better handled raw? idk
    let real_type =
      typeof type.prototype.render === 'function'
      ? type
      : class extends React.Component {
        static name = type.name;
        render() { return type(this.props) }
      }

    return {
      type: real_type,
      props: {
        ...props,
        children: props.children ? props.children : children,
      },
    };
  },

  createTreeType: (description = `React tree`) => {
    return Symbol(description);
  },

  // TODO Unnecessary ?
  Component: class ReactComponentPrototype {},
}

let DomTree = React.createTreeType('React DOM tree');
class DomElement extends React.Component {
  static tree = DomTree;

  mount() {
    let { parent, children } = this.tree;
    let { tagName, attributes } = this.props;

    let element = parent.document.createElement(tagName);

    if (attributes.style) {
      Object.assign(element.style, attributes.style);
    }

    for (let child of children) {
      element.appendChild(child.element);
    }

    this.exports = { element };
    // this.provides =
  }

  update() {
    // TODO
  }

  unmount() {
    // TODO
  }

  render() {
    return this.props.children;
  }
}

let Dom = {
  div: ({ children, ...props }) => {
    return <DomElement attributes={props} children={children} tagName="div" />
  },
  p: ({ children, ...props }) => {
    return <DomElement attributes={props} children={children} tagName="p" />
  },
  h1: ({ children, ...props }) => {
    return <DomElement attributes={props} children={children} tagName="h1" />
  },
  text: class DomText extends React.Component {
    static tree = DomTree;

    mount() {
      let { parent, children } = this.tree;
      let { text } = this.props;

      let element = parent.document.createTextNode(text);
      // for (let child of children) {
      //   element.appendChild(child.element);
      // }

      this.exports = { element };
      // this.provides =
    }

    render() {
      return null;
    }
  },
  mount: class Mount extends React.Component {
    static tree = DomTree;

    provide() {
      let { at: mount_element } = this.props;
      return { document: mount_element.ownerDocument }
    }

    mount() {
      let { at: mount_element } = this.props;
      let { children } = this.tree;

      console.log(`children:`, children)
      for (let child of children) {
        mount_element.appendChild(child.element);
      }

      // this.exports = ? - NO EXPORTS
    }

    render() {
      return this.props.children;
    }
  }
}

let App = () => {
  return (
    <Dom.div style={{ backgroundColor: 'red', padding: '50px' }}>
      <Dom.h1><Dom.text text="Title" /></Dom.h1>
      <Dom.p><Dom.text text="Some paragraph" /></Dom.p>
    </Dom.div>
  );
}

let instance = React.render(
  <Dom.mount at={document.querySelector('#root')}>
    <Dom.div style={{ margin: '50px' }}>
      <App />
    </Dom.div>
  </Dom.mount>
);

React.mount(instance);
console.log(`ROOT INSTANCE:`, instance)
