import { formatNumber } from "@/lib/format";

export function ConversionTable({
  fromSymbol,
  toSymbol,
  rows,
}: {
  fromSymbol: string;
  toSymbol: string;
  rows: { input: number; output: number }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-muted">
          <tr>
            <th className="px-4 py-2 font-medium">{fromSymbol}</th>
            <th className="px-4 py-2 font-medium">{toSymbol}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.input} className="border-t border-border">
              <td className="px-4 py-2">{formatNumber(row.input, "auto")}</td>
              <td className="px-4 py-2 font-medium">{formatNumber(row.output, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
