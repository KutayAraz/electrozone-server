export default interface QuantityChange {
    productName: string;
    oldQuantity: number;
    newQuantity: number;
    reason: 'QUANTITY_LIMIT_EXCEEDED' | 'STOCK_LIMIT_EXCEEDED';
}