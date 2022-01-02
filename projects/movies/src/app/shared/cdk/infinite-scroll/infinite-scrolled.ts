import {
  EMPTY,
  expand,
  isObservable,
  map,
  Observable,
  of,
  switchMap,
  take,
} from 'rxjs';
import { PaginatedResult } from '../../state/typings';
import { withLoadingEmission } from '../loading/withLoadingEmissions';
import {
  InfiniteScrollState,
  PaginationOptions,
} from './paginate-state.interface';

type PartialInfiniteScrollState<T> = Partial<InfiniteScrollState<T>>;

/**
 *
 * A helper function to trigger HTTP requesty on a paginated API.
 *
 * @example
 *
 * // To paginate a resource we need at minimal 2 things, the page number and the total pages.
 *
 * // Let's say you want to paginate the following http request:
 *  fetchList(id: number, pageNumber: number): Observable<{result: any[], total_pages: number}>
 *
 * // We want to get the result under the name `list`, not `results` as the APi provides.
 * // In this function the active page is hidden but the total pages is needed and named `totalPages`, so we need to map it too
 * const mapToPaginationResult = () => map(({ results, total_pages }) => ({list: results, totalPages: total_pages}))
 *
 * // And following trigger to fetch the new page:
 * load$: Observable<void>;
 *
 * // the implementation for a static id would lok like this:
 * const activeListId = 42;
 *
 * const paginated$: Observable<{list: any[]} & PaginatedState> =
 *    infiniteScrolled(
 *      (options, triggerID) => fetchList(triggerID, options.page).pipe(mapToPaginationResult()),
 *     load$.pipe(mapTo(activeListId))
 *    )
 * );
 *
 */
export function infiniteScrolled<T>(
  fetchFn: (
    options: PaginationOptions
  ) => Observable<PartialInfiniteScrollState<T>>,
  trigger$: Observable<any>,
  initialState:
    | PaginatedResult<any>
    | Observable<PaginatedResult<T>> = {} as PaginatedResult<any>
): Observable<PartialInfiniteScrollState<T>> {
  // We need to reduce the initial page by one as we start by incrementing it
  const initialResult$ = (
    isObservable(initialState) ? initialState : of(initialState)
  ).pipe(
    map((s) => {
      const { page, totalPages, ...rest } = s;
      // if no start result is given start with page 0, total pages 2 => next request will be page 1
      // if no initial result is given start with an empty list
      return {
        page: page ? page : 0,
        totalPages: totalPages || 2,
        ...rest,
      } as PaginatedResult<T>;
    }),
    // in case there is global state connected we take care of just taking the initial value
    take(1)
  );
  let page: number = 0;
  let totalPages: number = 2;
  return initialResult$.pipe(
    expand((result) => {
      console.log('expand: ', result, page, totalPages);
      let nextRequest$: Observable<PartialInfiniteScrollState<T>> =
        EMPTY as unknown as Observable<PartialInfiniteScrollState<T>>;
      // if it is a emission with a response ( hacky :( )
      if ('page' in result && 'totalPages' in result) {
        page = result.page + 1;
        totalPages = result.totalPages;

        if (page < totalPages) {
          nextRequest$ = trigger$.pipe(
            take(1),
            switchMap((_: any) => fetchFn({ page }).pipe(withLoadingEmission()))
          );
        }
      }
      return nextRequest$;
    })
  );
}
