import React from 'react';

const Table = ({
    columns,
    data,
    keyField,
    containerClassName = '',
    tableClassName = '',
    headerClassName = '',
    rowClassName = ''
}) => {
    return (
        <div className={`overflow-x-auto ${containerClassName}`.trim()}>
            <table className={`w-full text-sm text-left text-slate-500 ${tableClassName}`.trim()}>
                <thead className={`text-xs text-slate-700 uppercase bg-violet-50/60 border-b border-slate-200 ${headerClassName}`.trim()}>
                    <tr>
                        {columns.map((col, index) => (
                            <th key={index} scope="col" className="px-6 py-3 font-semibold tracking-wider">
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? (
                        data.map((row, rowIndex) => (
                            <tr
                                key={row?.[keyField] || `${rowIndex}`}
                                className={`bg-white/80 border-b border-slate-100 hover:bg-violet-50/50 transition-colors ${rowClassName}`.trim()}
                            >
                                {columns.map((col, idx) => (
                                    <td key={idx} className="px-6 py-4 whitespace-nowrap">
                                        {col.cell ? col.cell(row, rowIndex) : row[col.accessor]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-500 italic">
                                No data available.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default Table;
