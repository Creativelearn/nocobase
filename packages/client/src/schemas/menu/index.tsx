import React, {
  Children,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  forwardRef,
} from 'react';
import {
  connect,
  observer,
  mapProps,
  mapReadPretty,
  useField,
  useFieldSchema,
  RecursionField,
  Schema,
  SchemaOptionsContext,
  FormProvider,
  useForm,
} from '@formily/react';
import {
  Menu as AntdMenu,
  MenuProps,
  MenuItemProps,
  SubMenuProps,
  DividerProps,
  Dropdown,
  Modal,
  Button,
  Space,
} from 'antd';
import { uid } from '@formily/shared';
import cls from 'classnames';
import {
  SchemaField,
  SchemaRenderer,
  useDesignable,
} from '../../components/schema-renderer';
import {
  MenuOutlined,
  PlusOutlined,
  GroupOutlined,
  LinkOutlined,
  DeleteOutlined,
  EditOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowRightOutlined,
  DragOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { IconPicker } from '../../components/icon-picker';
import { useDefaultAction } from '..';
import { useMount } from 'ahooks';
import './style.less';
import { findPropertyByPath, getSchemaPath, useSchemaPath } from '../../';
import { generateDefaultSchema } from './defaultSchemas';
import _, { cloneDeep, get, isNull } from 'lodash';
import { FormDialog, FormItem, FormLayout, Input } from '@formily/antd';
import deepmerge from 'deepmerge';
import { onFieldChange } from '@formily/core';
import { VisibleContext } from '../../context';
import {
  DragHandle,
  SortableItem,
  SortableItemContext,
} from '../../components/Sortable';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { createPortal } from 'react-dom';
import { Resource } from '../../resource';
import { useClient } from '../../constate';

export interface MenuContextProps {
  schema?: Schema;
  onRemove?: any;
}

export const MenuModeContext = createContext(null);
export const MenuContext = createContext<MenuContextProps>(null);

const SideMenu = (props: any) => {
  const { selectedKey, defaultSelectedKeys, onSelect, path } = props;
  const { schema } = useDesignable();
  const [selectedKeys, setSelectedKeys] = useState(defaultSelectedKeys);
  useEffect(() => {
    setSelectedKeys(defaultSelectedKeys);
  }, [defaultSelectedKeys]);
  if (!selectedKey) {
    return null;
  }
  const child = schema.properties && schema.properties[selectedKey];
  if (!child || child['x-component'] !== 'Menu.SubMenu') {
    return null;
  }

  return (
    <MenuModeContext.Provider value={'inline'}>
      <AntdMenu
        mode={'inline'}
        onSelect={onSelect}
        onOpenChange={(openKeys) => {
          setSelectedKeys(openKeys);
        }}
        openKeys={selectedKeys}
        selectedKeys={selectedKeys}
      >
        <RecursionField schema={child} onlyRenderProperties />
        <Menu.AddNew key={uid()} path={[...path, selectedKey]}>
          <Button
            // block
            type={'dashed'}
            icon={<PlusOutlined />}
            className={`nb-add-new-menu-item menu-mode-inline designable-btn designable-btn-dash`}
          >
            添加菜单项
          </Button>
        </Menu.AddNew>
      </AntdMenu>
    </MenuModeContext.Provider>
  );
};

export const MenuSelectedKeysContext = createContext<any>([]);

export const Menu: any = observer((props: any) => {
  const {
    mode,
    onSelect,
    sideMenuRef,
    defaultSelectedKeys: keys,
    getSelectedKeys,
    onRemove,
    ...others
  } = props;
  const defaultSelectedKeys = useContext(MenuSelectedKeysContext);
  const { root, schema, insertAfter, remove } = useDesignable();
  const moveToAfter = (path1, path2) => {
    if (!path1 || !path2) {
      return;
    }
    if (path1.join('.') === path2.join('.')) {
      return;
    }
    const data = findPropertyByPath(root, path1);
    if (!data) {
      return;
    }
    remove(path1);
    return insertAfter(data.toJSON(), path2);
  };
  const fieldSchema = useFieldSchema();
  console.log('Menu.schema', schema, fieldSchema);
  const [selectedKey, setSelectedKey] = useState(
    defaultSelectedKeys[0] || null,
  );
  const ref = useRef();
  const path = useSchemaPath();
  const child = schema.properties && schema.properties[selectedKey];
  const isSubMenu = child && child['x-component'] === 'Menu.SubMenu';
  const { updateSchema } = useClient();

  useMount(() => {
    if (mode !== 'mix') {
      return;
    }
    const sideMenuElement = sideMenuRef && (sideMenuRef.current as HTMLElement);
    if (!sideMenuElement) {
      return;
    }
    if (sideMenuElement && ref.current) {
      sideMenuElement.querySelector(':scope > div').appendChild(ref.current);
    }
    sideMenuElement.style.display = isSubMenu ? 'block' : 'none';
  });

  useEffect(() => {
    const sideMenuElement = sideMenuRef && (sideMenuRef.current as HTMLElement);
    if (!sideMenuElement) {
      return;
    }
    sideMenuElement.style.display = isSubMenu ? 'block' : 'none';
  }, [selectedKey]);

  const [dragOverlayContent, setDragOverlayContent] = useState('');
  // console.log('defaultSelectedKeys', defaultSelectedKeys, getSelectedKeys);
  return (
    <MenuContext.Provider value={{ schema, onRemove }}>
      <DndContext
        onDragStart={(event) => {
          console.log({ event });
          setDragOverlayContent(event.active.data?.current?.title || '');
        }}
        onDragEnd={async (event) => {
          console.log({ event });
          const path1 = event.active?.data?.current?.path;
          const path2 = event.over?.data?.current?.path;
          const data = moveToAfter(path1, path2);
          await updateSchema(data);
        }}
      >
        {createPortal(
          <DragOverlay
            style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
            dropAnimation={{
              duration: 10,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {dragOverlayContent}
          </DragOverlay>,
          document.body,
        )}
        <MenuModeContext.Provider value={mode}>
          <AntdMenu
            defaultOpenKeys={defaultSelectedKeys}
            defaultSelectedKeys={defaultSelectedKeys}
            {...others}
            mode={mode === 'mix' ? 'horizontal' : mode}
            onSelect={(info) => {
              if (mode === 'mix') {
                setSelectedKey(info.key);
              }
              const selectedSchema = schema.properties[info.key];
              console.log({ selectedSchema });
              onSelect && onSelect({ ...info, schema: selectedSchema });
            }}
          >
            <RecursionField schema={schema} onlyRenderProperties />
            <Menu.AddNew key={uid()} path={path}>
              {/* <PlusOutlined className={'nb-add-new-icon'} /> */}
              <Button
                className={`designable-btn designable-btn-dash nb-add-new-menu-item designable menu-mode-${
                  mode === 'mix' ? 'horizontal' : mode
                }`}
                block
                icon={<PlusOutlined />}
                type={mode == 'inline' ? 'dashed' : 'primary'}
              >
                添加菜单项
              </Button>
            </Menu.AddNew>
          </AntdMenu>
          {mode === 'mix' && (
            <div ref={ref}>
              <SideMenu
                path={path}
                onSelect={(info) => {
                  const keyPath = [selectedKey, ...[...info.keyPath].reverse()];
                  const selectedSchema = findPropertyByPath(schema, keyPath);
                  console.log('keyPath', keyPath, selectedSchema);
                  onSelect &&
                    onSelect({ ...info, keyPath, schema: selectedSchema });
                }}
                defaultSelectedKeys={defaultSelectedKeys || []}
                selectedKey={selectedKey}
                sideMenuRef={sideMenuRef}
              />
            </div>
          )}
        </MenuModeContext.Provider>
      </DndContext>
    </MenuContext.Provider>
  );
});

Menu.Divider = observer(AntdMenu.Divider);

Menu.Item = observer((props: any) => {
  const { icon } = props;
  const { schema, DesignableBar } = useDesignable();
  return (
    <AntdMenu.Item
      {...props}
      icon={null}
      eventKey={schema.name}
      key={schema.name}
    >
      <SortableItem
        id={schema.name}
        data={{
          title: schema.title,
          path: getSchemaPath(schema),
        }}
      >
        {icon && (
          <span style={{ marginRight: 10 }}>
            <IconPicker type={icon} />
          </span>
        )}
        {schema.title}
        <DesignableBar />
      </SortableItem>
    </AntdMenu.Item>
  );
});

Menu.Link = observer((props: any) => {
  const { icon } = props;
  const { schema, DesignableBar } = useDesignable();
  return (
    <AntdMenu.Item
      {...props}
      icon={null}
      eventKey={schema.name}
      key={schema.name}
    >
      <SortableItem
        id={schema.name}
        data={{
          title: schema.title,
          path: getSchemaPath(schema),
        }}
      >
        {icon && (
          <span style={{ marginRight: 10 }}>
            <IconPicker type={icon} />
          </span>
        )}
        {schema.title}
        <DesignableBar />
      </SortableItem>
      {/* <Link to={props.to || schema.name}>{schema.title}</Link> */}
      <DesignableBar />
    </AntdMenu.Item>
  );
});

Menu.URL = observer((props: any) => {
  const { icon } = props;
  const { schema, DesignableBar } = useDesignable();
  return (
    <AntdMenu.Item
      {...props}
      icon={null}
      eventKey={schema.name}
      key={schema.name}
      onClick={(info) => {
        window.open(props.href);
      }}
    >
      <SortableItem
        id={schema.name}
        data={{
          title: schema.title,
          path: getSchemaPath(schema),
        }}
      >
        {icon && (
          <span style={{ marginRight: 10 }}>
            <IconPicker type={icon} />
          </span>
        )}
        {schema.title}
        <DesignableBar />
      </SortableItem>
      <DesignableBar />
    </AntdMenu.Item>
  );
});

Menu.Action = observer((props: any) => {
  const { icon, useAction = useDefaultAction, ...others } = props;
  const { schema, DesignableBar } = useDesignable();
  const field = useField();
  const [visible, setVisible] = useState(false);
  const { run } = useAction();
  return (
    <VisibleContext.Provider value={[visible, setVisible]}>
      <AntdMenu.Item
        {...others}
        key={schema.name}
        eventKey={schema.name}
        icon={<IconPicker type={icon} />}
        onClick={async () => {
          await run();
          setVisible(true);
        }}
      >
        <SortableItem
          id={schema.name}
          data={{
            title: schema.title,
            path: getSchemaPath(schema),
          }}
        >
          {schema.title}
          <DesignableBar />
        </SortableItem>
      </AntdMenu.Item>
      {props.children}
      {/* <RecursionField schema={schema} onlyRenderProperties /> */}
    </VisibleContext.Provider>
  );
});

Menu.SubMenu = observer((props: any) => {
  const { icon } = props;
  const { schema, DesignableBar } = useDesignable();
  const mode = useContext(MenuModeContext);
  return mode === 'mix' ? (
    <Menu.Item {...props} />
  ) : (
    <AntdMenu.SubMenu
      {...props}
      icon={null}
      // icon={<IconPicker type={icon} />}
      title={
        <SortableItem
          id={schema.name}
          data={{
            title: schema.title,
            path: getSchemaPath(schema),
          }}
        >
          {icon && (
            <span style={{ marginRight: 10 }}>
              <IconPicker type={icon} />
            </span>
          )}
          {schema.title}
          <DesignableBar />
        </SortableItem>
        // <>
        //   {schema.title} <DesignableBar />
        // </>
      }
      eventKey={schema.name}
      key={schema.name}
    >
      <RecursionField schema={schema} onlyRenderProperties />
    </AntdMenu.SubMenu>
  );
});

Menu.AddNew = observer((props: any) => {
  const { designable, appendChild } = useDesignable(props.path);
  const { createSchema, removeSchema, updateSchema } = useClient();
  if (!designable) {
    return null;
  }
  const schemas = {
    'Menu.Link': {
      icon: <MenuOutlined />,
      title: '添加页面',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
        },
      },
    },
    'Menu.SubMenu': {
      icon: <GroupOutlined />,
      title: '添加分组',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
        },
      },
    },
    'Menu.URL': {
      icon: <LinkOutlined />,
      title: '添加链接',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
          'x-component-props.href': {
            type: 'string',
            title: '链接',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
        },
      },
    },
  };

  return (
    <AntdMenu.ItemGroup
      className={'nb-menu-add-new'}
      title={
        <Dropdown
          // trigger={['click']}
          overlay={
            <AntdMenu
              onClick={async (info) => {
                console.log({ info });
                const values = await FormDialog(schemas[info.key].title, () => {
                  return (
                    <FormLayout layout={'vertical'}>
                      <SchemaField schema={schemas[info.key].schema} />
                    </FormLayout>
                  );
                }).open();
                const defaults = generateDefaultSchema(info.key);
                const data = appendChild(deepmerge(defaults, values));
                await createSchema(data);
              }}
            >
              <AntdMenu.Item key={'Menu.SubMenu'} icon={<GroupOutlined />}>
                分组
              </AntdMenu.Item>
              <AntdMenu.Item key={'Menu.Link'} icon={<MenuOutlined />}>
                页面
              </AntdMenu.Item>
              <AntdMenu.Item key={'Menu.URL'} icon={<LinkOutlined />}>
                链接
              </AntdMenu.Item>
            </AntdMenu>
          }
        >
          {props.children}
        </Dropdown>
      }
    />
  );
});

Menu.DesignableBar = (props) => {
  const schemas = {
    'Menu.Action': {
      icon: <MenuOutlined />,
      title: '页面',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
        },
      },
    },
    'Menu.Item': {
      icon: <MenuOutlined />,
      title: '页面',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
        },
      },
    },
    'Menu.Link': {
      icon: <MenuOutlined />,
      title: '页面',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
        },
      },
    },
    'Menu.SubMenu': {
      icon: <GroupOutlined />,
      title: '分组',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
        },
      },
    },
    'Menu.URL': {
      icon: <LinkOutlined />,
      title: '链接',
      schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            title: '名称',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
          'x-component-props.icon': {
            type: 'string',
            title: '图标',
            'x-decorator': 'FormItem',
            'x-component': 'IconPicker',
          },
          'x-component-props.href': {
            type: 'string',
            title: '链接',
            required: true,
            'x-decorator': 'FormItem',
            'x-component': 'Input',
          },
        },
      },
    },
  };

  const field = useField();
  const [visible, setVisible] = useState(false);
  const {
    designable,
    schema,
    remove,
    refresh,
    insertAfter,
    insertBefore,
    appendChild,
  } = useDesignable();
  const formConfig = schemas[schema['x-component']];
  const isSubMenu = schema['x-component'] === 'Menu.SubMenu';
  const ctx = useContext(MenuContext);
  const mode = useContext(MenuModeContext);
  const { createSchema, removeSchema, updateSchema } = useClient();

  return (
    <div className={cls('designable-bar', { active: visible })}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        className={'designable-bar-actions'}
      >
        <Space size={2}>
          <DragHandle />
          <Dropdown
            overlayStyle={{
              minWidth: 150,
            }}
            trigger={['hover']}
            overlay={
              <AntdMenu
                onClick={async (info) => {
                  if (['update', 'move', 'delete'].includes(info.key)) {
                    return;
                  }
                  const methodLabels = {
                    insertBefore: '之前',
                    insertAfter: '之后',
                    appendChild: '里',
                  };
                  const keys = info.key.split('.');
                  const method = keys.shift();
                  const type = keys.join('.');
                  const config = schemas[type];
                  if (!config) {
                    return;
                  }
                  const values = await FormDialog(
                    `在「${schema.title}」${methodLabels[method]}插入${config.title}`,
                    () => {
                      return (
                        <FormLayout layout={'vertical'}>
                          <SchemaField schema={config.schema} />
                        </FormLayout>
                      );
                    },
                  ).open();
                  const methods = {
                    insertAfter,
                    insertBefore,
                    appendChild,
                  };
                  const defaults = generateDefaultSchema(type);
                  const data = methods[method](deepmerge(defaults, values));
                  await createSchema(data);
                }}
              >
                <AntdMenu.Item
                  key={'update'}
                  onClick={async () => {
                    const initialValues = {};
                    Object.keys(formConfig.schema.properties).forEach(
                      (name) => {
                        _.set(initialValues, name, get(schema, name));
                      },
                    );
                    const values = await FormDialog(`编辑菜单项`, () => {
                      return (
                        <FormLayout layout={'vertical'}>
                          <SchemaField schema={formConfig.schema} />
                        </FormLayout>
                      );
                    }).open({
                      initialValues,
                    });
                    if (values.title) {
                      schema.title = values.title;
                    }
                    const icon =
                      _.get(values, 'x-component-props.icon') || null;
                    schema['x-component-props'] =
                      schema['x-component-props'] || {};
                    schema['x-component-props']['icon'] = icon;
                    field.componentProps['icon'] = icon;
                    refresh();
                    await updateSchema(schema);
                  }}
                >
                  <EditOutlined /> 编辑菜单项
                </AntdMenu.Item>
                <AntdMenu.Item
                  key={'move'}
                  onClick={async () => {
                    let menuSchema: Schema;
                    let parent = schema.parent;
                    while (parent) {
                      if (parent['x-component'] === 'Menu') {
                        menuSchema = parent;
                        break;
                      }
                      parent = parent.parent;
                    }

                    console.log({ menuSchema });

                    const toTreeData = (s: Schema) => {
                      const items = [];
                      Object.keys(s.properties || {}).forEach((name) => {
                        const current = s.properties[name];
                        if (
                          !(current['x-component'] as string).startsWith(
                            'Menu.',
                          )
                        ) {
                          return;
                        }
                        // if (current.name === schema.name) {
                        //   return;
                        // }
                        items.push({
                          key: current['key'] || current.name,
                          label: current.title,
                          title: current.title,
                          value: getSchemaPath(current).join('.'),
                          children: toTreeData(current),
                        });
                      });
                      return items;
                    };

                    const dataSource = toTreeData(menuSchema);

                    const values = await FormDialog(
                      `将「${schema.title}」移动到`,
                      () => {
                        return (
                          <FormLayout layout={'vertical'}>
                            <SchemaField
                              schema={{
                                type: 'object',
                                properties: {
                                  path: {
                                    type: 'string',
                                    title: '目标位置',
                                    enum: dataSource,
                                    'x-decorator': 'FormItem',
                                    'x-component': 'TreeSelect',
                                  },
                                  method: {
                                    type: 'string',
                                    default: 'insertAfter',
                                    enum: [
                                      { label: '之后', value: 'insertAfter' },
                                      { label: '之前', value: 'insertBefore' },
                                    ],
                                    'x-decorator': 'FormItem',
                                    'x-component': 'Radio.Group',
                                  },
                                },
                              }}
                            />
                          </FormLayout>
                        );
                      },
                    ).open({
                      effects(form) {
                        onFieldChange('path', (field) => {
                          const target = findPropertyByPath(
                            schema.root,
                            // @ts-ignore
                            field.value,
                          );
                          console.log({ field });
                          field.query('method').take((f) => {
                            // @ts-ignore
                            // f.value = 'insertAfter';
                            // @ts-ignore
                            f.dataSource =
                              target['x-component'] === 'Menu.SubMenu'
                                ? [
                                    { label: '之后', value: 'insertAfter' },
                                    { label: '之前', value: 'insertBefore' },
                                    { label: '组里', value: 'appendChild' },
                                  ]
                                : [
                                    { label: '之后', value: 'insertAfter' },
                                    { label: '之前', value: 'insertBefore' },
                                  ];
                          });
                        });
                      },
                    });
                    const methods = {
                      insertAfter,
                      insertBefore,
                      appendChild,
                    };
                    const data = schema.toJSON();
                    remove();
                    const source = methods[values.method](data, values.path);
                    await updateSchema(source);
                  }}
                >
                  <DragOutlined /> 移动到
                </AntdMenu.Item>
                <AntdMenu.Divider />
                <AntdMenu.SubMenu
                  key={'insertBefore'}
                  icon={<ArrowUpOutlined />}
                  title={`向${mode == 'inline' ? '上' : '左'}插入`}
                >
                  <AntdMenu.Item
                    key={'insertBefore.Menu.SubMenu'}
                    icon={<GroupOutlined />}
                  >
                    分组
                  </AntdMenu.Item>
                  <AntdMenu.Item
                    key={'insertBefore.Menu.Link'}
                    icon={<MenuOutlined />}
                  >
                    页面
                  </AntdMenu.Item>
                  <AntdMenu.Item
                    key={'insertBefore.Menu.URL'}
                    icon={<LinkOutlined />}
                  >
                    链接
                  </AntdMenu.Item>
                </AntdMenu.SubMenu>
                <AntdMenu.SubMenu
                  key={'insertAfter'}
                  icon={<ArrowDownOutlined />}
                  title={`向${mode == 'inline' ? '下' : '右'}插入`}
                >
                  <AntdMenu.Item
                    key={'insertAfter.Menu.SubMenu'}
                    icon={<GroupOutlined />}
                  >
                    分组
                  </AntdMenu.Item>
                  <AntdMenu.Item
                    key={'insertAfter.Menu.Link'}
                    icon={<MenuOutlined />}
                  >
                    页面
                  </AntdMenu.Item>
                  <AntdMenu.Item
                    key={'insertAfter.Menu.URL'}
                    icon={<LinkOutlined />}
                  >
                    链接
                  </AntdMenu.Item>
                </AntdMenu.SubMenu>
                {isSubMenu && (
                  <AntdMenu.SubMenu
                    key={'appendChild'}
                    icon={<ArrowRightOutlined />}
                    title={'向里插入'}
                  >
                    <AntdMenu.Item
                      key={'appendChild.Menu.SubMenu'}
                      icon={<GroupOutlined />}
                    >
                      分组
                    </AntdMenu.Item>
                    <AntdMenu.Item
                      key={'appendChild.Menu.Link'}
                      icon={<MenuOutlined />}
                    >
                      页面
                    </AntdMenu.Item>
                    <AntdMenu.Item
                      key={'appendChild.Menu.URL'}
                      icon={<LinkOutlined />}
                    >
                      链接
                    </AntdMenu.Item>
                  </AntdMenu.SubMenu>
                )}
                {/* <AntdMenu.Divider />
                <AntdMenu.Item
                  icon={<LockOutlined />}
                  onClick={async () => {
                    const loadRoles = async () => {
                      const resource = Resource.make('roles');
                      const data = await resource.list();
                      console.log('loadRoles', data);
                      return data?.data.map((item) => ({
                        label: item.title,
                        value: item.name,
                      }));
                    };
                    const resource = Resource.make({
                      associatedName: 'ui_schemas',
                      associatedKey: schema['key'],
                      resourceName: 'roles',
                    });
                    const uiSchemasRoles = await resource.list();
                    console.log({ uiSchemasRoles });
                    const values = await FormDialog(`设置权限`, () => {
                      return (
                        <FormLayout layout={'vertical'}>
                          <SchemaField
                            scope={{ loadRoles }}
                            schema={{
                              type: 'object',
                              properties: {
                                roles: {
                                  type: 'array',
                                  title: '允许访问的角色',
                                  'x-reactions': [
                                    '{{useAsyncDataSource(loadRoles)}}',
                                  ],
                                  'x-decorator': 'FormilyFormItem',
                                  'x-component': 'Select',
                                  'x-component-props': {
                                    mode: 'tags',
                                  },
                                },
                              },
                            }}
                          />
                        </FormLayout>
                      );
                    }).open({
                      initialValues: {
                        roles: uiSchemasRoles?.data?.map((role) => role.name),
                      },
                    });
                    await Resource.make({
                      resourceName: 'ui_schemas',
                      resourceKey: schema['key'],
                    }).save(values);
                  }}
                >
                  设置权限
                </AntdMenu.Item> */}
                <AntdMenu.Divider />
                <AntdMenu.Item
                  key={'delete'}
                  onClick={() => {
                    Modal.confirm({
                      title: `删除${formConfig.title}`,
                      content: '删除后无法恢复，确定要删除吗？',
                      onOk: async () => {
                        const target = remove();
                        await removeSchema(target);
                        ctx.onRemove && ctx.onRemove(target);
                      },
                    });
                  }}
                >
                  <DeleteOutlined /> 删除
                </AntdMenu.Item>
              </AntdMenu>
            }
          >
            <MenuOutlined />
          </Dropdown>
        </Space>
      </div>
    </div>
  );
};

export default Menu;
