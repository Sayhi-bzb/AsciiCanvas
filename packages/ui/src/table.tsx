import * as React from 'react';

import { cn } from './utils.js';
import { rx } from './recipes.js';

type TableDensity = 'default' | 'compact';
type TableRowHover = 'highlight' | 'none';

type TableProps = React.ComponentProps<'table'> & {
  density?: TableDensity;
  rowHover?: TableRowHover;
  containerClassName?: string;
};

const TableContext = React.createContext<{
  density: TableDensity;
  rowHover: TableRowHover;
}>({ density: 'default', rowHover: 'highlight' });

function Table({
  className,
  containerClassName,
  density = 'default',
  rowHover = 'highlight',
  ...props
}: TableProps) {
  return (
    <TableContext.Provider value={{ density, rowHover }}>
      <div
        data-slot="table-container"
        className={cn('relative w-full overflow-x-auto', containerClassName)}
      >
        <table
          data-slot="table"
          data-density={density}
          data-row-hover={rowHover}
          className={cn(
            'w-full caption-bottom',
            density === 'compact' ? rx.panelText() : 'text-sm',
            className
          )}
          {...props}
        />
      </div>
    </TableContext.Provider>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
  return (
    <thead
      data-slot="table-header"
      className={cn('[&_tr]:border-b [&_tr]:border-separator', className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<'tr'>) {
  const { rowHover } = React.useContext(TableContext);
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b border-separator transition-colors',
        rowHover === 'highlight' && 'hover:bg-accent',
        className
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<'th'>) {
  const { density } = React.useContext(TableContext);
  return (
    <th
      data-slot="table-head"
      className={cn(
        'px-3 text-left align-middle text-xs font-medium text-muted-foreground',
        density === 'compact' ? 'h-8' : 'h-10',
        className
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<'td'>) {
  const { density } = React.useContext(TableContext);
  return (
    <td
      data-slot="table-cell"
      className={cn('px-3 align-middle', density === 'compact' ? 'h-8' : 'h-10', className)}
      {...props}
    />
  );
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
