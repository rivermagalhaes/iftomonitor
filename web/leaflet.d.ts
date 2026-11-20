// Tipos mínimos do Leaflet usados pelo painel (mapa da viagem e "Ao vivo").
declare module 'leaflet' {
 type Coordinate=[number,number];
 interface LatLng {lat:number;lng:number}
 interface Layer {addTo(target:Map|LayerGroup):this;bindPopup(content:Node):this;bindTooltip(text:string,options?:{permanent?:boolean;direction?:string;offset?:Coordinate}):this;openPopup():this}
 interface LayerGroup extends Layer {clearLayers():this}
 interface CircleMarker extends Layer {getLatLng():LatLng}
 interface Map {setView(point:Coordinate|LatLng,zoom:number):Map;fitBounds(bounds:unknown,options?:{maxZoom?:number;padding?:Coordinate}):Map;remove():void}
 const L:{map(element:HTMLElement):Map;tileLayer(url:string,options:{attribution:string;maxZoom?:number}):Layer;layerGroup():LayerGroup;polyline(points:Coordinate[],options:{color:string;dashArray?:string;weight?:number;opacity?:number}):Layer;circleMarker(point:Coordinate,options?:{radius?:number;color?:string;weight?:number;fillColor?:string;fillOpacity?:number}):CircleMarker;latLngBounds(points:Coordinate[]):unknown};
 export default L;
 export type {Map,LayerGroup,CircleMarker,LatLng};
}
